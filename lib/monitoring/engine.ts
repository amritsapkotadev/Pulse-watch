import "server-only";

import { Prisma, type Monitor } from "@/generated/prisma/client";
import { IncidentSeverity, IncidentStatus, MonitorStatus } from "@/generated/prisma/enums";
import { getBatchSize, getFailureThreshold, getLeaseSeconds, getMaxConcurrentChecks } from "@/lib/monitoring/config";
import { calculateAverageResponseTime, calculateUptime } from "@/lib/monitoring/metrics";
import { sanitizeErrorMessage } from "@/lib/monitoring/sanitize";
import { validateMonitorTarget } from "@/lib/monitoring/ssrf";
import type { MonitorStatusValue } from "@/lib/monitoring/types";
import { prisma } from "@/lib/db";
import { executeHttpRequest, RequestExecutionError } from "@/lib/server/request-executor";
import { HTTP_METHODS, type HttpMethod } from "@/lib/requests/schema";

interface CheckOutcome {
  status: MonitorStatusValue;
  statusCode: number | null;
  responseTime: number;
  responseSize: number;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface MonitorRunSummary {
  due: number;
  executed: number;
  skipped: number;
  failed: number;
}

export async function executeMonitorCheck(monitorId: string): Promise<void> {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) throw new Error("Monitor not found.");

  const outcome = await performRequest(monitor);
  await persistOutcome(monitor, outcome);
}

export async function runDueChecks(ownerId = `scheduler-${process.pid}`): Promise<MonitorRunSummary> {
  const now = new Date();
  const monitors = await prisma.monitor.findMany({
    where: {
      isActive: true,
      OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
    },
    orderBy: { nextCheckAt: "asc" },
    take: getBatchSize(),
  });

  let executed = 0;
  let skipped = 0;
  let failed = 0;

  await mapWithConcurrency(monitors, getMaxConcurrentChecks(), async (monitor) => {
    const acquired = await acquireMonitorLease(monitor.id, ownerId);
    if (!acquired) {
      skipped += 1;
      return;
    }

    try {
      await executeMonitorCheck(monitor.id);
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          nextCheckAt: new Date(Date.now() + Math.max(1, monitor.intervalMinutes) * 60_000),
        },
      });
      executed += 1;
    } catch {
      failed += 1;
    } finally {
      await releaseMonitorLease(monitor.id, ownerId);
    }
  });

  return { due: monitors.length, executed, skipped, failed };
}

export async function acquireMonitorLease(monitorId: string, ownerId: string): Promise<boolean> {
  const acquiredAt = new Date();
  const expiresAt = new Date(acquiredAt.getTime() + getLeaseSeconds() * 1000);
  const claimed = await prisma.$queryRaw<Array<{ monitorId: string }>>`
    INSERT INTO "MonitorLease" ("monitorId", "ownerId", "acquiredAt", "expiresAt")
    VALUES (${monitorId}, ${ownerId}, ${acquiredAt}, ${expiresAt})
    ON CONFLICT ("monitorId") DO UPDATE
    SET "ownerId" = EXCLUDED."ownerId",
        "acquiredAt" = EXCLUDED."acquiredAt",
        "expiresAt" = EXCLUDED."expiresAt"
    WHERE "MonitorLease"."expiresAt" <= ${acquiredAt}
    RETURNING "monitorId"
  `;
  return claimed.length > 0;
}

export async function releaseMonitorLease(monitorId: string, ownerId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "MonitorLease"
    WHERE "monitorId" = ${monitorId} AND "ownerId" = ${ownerId}
  `;
}

async function performRequest(monitor: Monitor): Promise<CheckOutcome> {
  const checkedAt = new Date();

  try {
    await validateMonitorTarget(monitor.url);
    const method = HTTP_METHODS.includes(monitor.method as HttpMethod)
      ? (monitor.method as HttpMethod)
      : "GET";
    const result = await executeHttpRequest(
      {
        method,
        url: monitor.url,
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none" },
      },
      `monitor:${monitor.id}`,
      {
        timeoutMs: Math.max(1, monitor.timeoutSeconds) * 1000,
        skipRateLimit: true,
        skipConcurrencyLimit: true,
      },
    );
    const isUp = result.status === monitor.expectedStatus;
    return {
      status: isUp ? MonitorStatus.UP : MonitorStatus.DOWN,
      statusCode: result.status,
      responseTime: result.timeMs,
      responseSize: result.size,
      errorMessage: isUp
        ? null
        : sanitizeErrorMessage(`Unexpected status ${result.status}; expected ${monitor.expectedStatus}.`),
      checkedAt,
    };
  } catch (error) {
    const message = error instanceof RequestExecutionError ? error.message : "The monitor check failed.";
    return {
      status: MonitorStatus.DOWN,
      statusCode: null,
      responseTime: 0,
      responseSize: 0,
      errorMessage: sanitizeErrorMessage(message),
      checkedAt,
    };
  }
}

async function persistOutcome(monitor: Monitor, outcome: CheckOutcome): Promise<void> {
  const failureThreshold = getFailureThreshold();
  const consecutiveFailures = outcome.status === MonitorStatus.DOWN ? monitor.consecutiveFailures + 1 : 0;
  const statusChangedAt =
    monitor.currentStatus === outcome.status ? monitor.statusChangedAt : outcome.checkedAt;

  await prisma.$transaction(async (tx) => {
    await tx.monitorCheck.create({
      data: {
        monitorId: monitor.id,
        status: outcome.status,
        statusCode: outcome.statusCode,
        responseTime: outcome.responseTime,
        responseSize: outcome.responseSize,
        errorMessage: outcome.errorMessage,
        checkedAt: outcome.checkedAt,
      },
    });

    await tx.monitor.update({
      where: { id: monitor.id },
      data: {
        currentStatus: outcome.status,
        lastCheckedAt: outcome.checkedAt,
        lastResponseTime: outcome.status === MonitorStatus.UP ? outcome.responseTime : null,
        lastStatusCode: outcome.statusCode,
        consecutiveFailures,
        statusChangedAt,
      },
    });

    const activeIncident = await tx.incident.findFirst({
      where: { monitorId: monitor.id, status: IncidentStatus.ACTIVE },
      orderBy: { startedAt: "desc" },
    });

    if (outcome.status === MonitorStatus.DOWN && consecutiveFailures >= failureThreshold) {
      const severity =
        consecutiveFailures >= failureThreshold * 3
          ? IncidentSeverity.CRITICAL
          : IncidentSeverity.WARNING;
      if (activeIncident) {
        await tx.incident.update({
          where: { id: activeIncident.id },
          data: {
            severity: activeIncident.severity === IncidentSeverity.CRITICAL ? activeIncident.severity : severity,
            description: outcome.errorMessage ?? "The monitor is unavailable.",
            lastSeenAt: outcome.checkedAt,
            occurrenceCount: { increment: 1 },
          },
        });
      } else {
        await tx.incident.create({
          data: {
            monitorId: monitor.id,
            title: `${monitor.name} is down`,
            description: outcome.errorMessage ?? "The monitor is unavailable.",
            severity,
            status: IncidentStatus.ACTIVE,
            startedAt: outcome.checkedAt,
            lastSeenAt: outcome.checkedAt,
          },
        });
      }
      return;
    }

    if (outcome.status === MonitorStatus.UP && activeIncident) {
      await tx.incident.update({
        where: { id: activeIncident.id },
        data: {
          status: IncidentStatus.RESOLVED,
          resolvedAt: outcome.checkedAt,
          description: "The monitor recovered successfully.",
        },
      });
    }
  });
}

export function summarizeMonitorChecks(
  checks: Array<{ status: MonitorStatusValue; responseTime: number }>,
): { uptimePercentage: number; averageResponseTimeMs: number } {
  return {
    uptimePercentage: calculateUptime(checks),
    averageResponseTimeMs: calculateAverageResponseTime(checks),
  };
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => consume()));
}

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function upsertWorkspaceState(
  tx: PrismaTransaction,
  activeEnvironmentId: string | null,
): Promise<void> {
  await tx.workspaceState.upsert({
    where: { id: "singleton" },
    update: { activeEnvironmentId },
    create: { id: "singleton", activeEnvironmentId },
  });
}

export function serializableError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return "The database rejected this operation.";
  }
  return "The operation could not be completed.";
}
