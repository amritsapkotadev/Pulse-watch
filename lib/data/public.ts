import "server-only";

import { Prisma, type Monitor } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  buildResponseTimeSeries,
  calculateAverageResponseTime,
  calculateUptime,
  rangeToStartDate,
} from "@/lib/monitoring/metrics";
import type {
  HistoryRange,
  MonitorHistoryDto,
  MonitorStatusValue,
  PublicIncidentDto,
  PublicMonitorDto,
} from "@/lib/monitoring/types";

const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 500;

type IncidentWithMonitor = Prisma.IncidentGetPayload<{
  include: { monitor: { select: { name: true } } };
}>;

export async function getPublicOverview(): Promise<{
  totalMonitors: number;
  operationalMonitors: number;
  downMonitors: number;
  unknownMonitors: number;
  uptimePercentage: number;
  averageResponseTimeMs: number;
  recentIncidents: PublicIncidentDto[];
}> {
  const since = new Date(Date.now() - UPTIME_WINDOW_MS);
  const [monitors, checks, incidents] = await Promise.all([
    prisma.monitor.findMany({
      where: { isActive: true, displayPublicly: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.monitorCheck.findMany({
      where: { checkedAt: { gte: since }, monitor: { isActive: true, displayPublicly: true } },
      select: { monitorId: true, status: true, responseTime: true },
    }),
    prisma.incident.findMany({
      where: {
        monitor: { isActive: true, displayPublicly: true },
        OR: [{ status: "ACTIVE" }, { resolvedAt: { gte: new Date(Date.now() - 7 * UPTIME_WINDOW_MS) } }],
      },
      include: { monitor: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalMonitors: monitors.length,
    operationalMonitors: monitors.filter((monitor) => monitor.currentStatus === "UP").length,
    downMonitors: monitors.filter((monitor) => monitor.currentStatus === "DOWN").length,
    unknownMonitors: monitors.filter((monitor) => monitor.currentStatus === "UNKNOWN").length,
    uptimePercentage: calculateUptime(checks),
    averageResponseTimeMs: calculateAverageResponseTime(checks),
    recentIncidents: incidents.map(mapIncident),
  };
}

export async function getPublicMonitors(
  page: number,
  pageSize: number,
): Promise<{ monitors: PublicMonitorDto[]; total: number }> {
  const [total, monitors] = await Promise.all([
    prisma.monitor.count({ where: { isActive: true, displayPublicly: true } }),
    prisma.monitor.findMany({
      where: { isActive: true, displayPublicly: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const since = new Date(Date.now() - UPTIME_WINDOW_MS);
  const checks = await prisma.monitorCheck.findMany({
    where: { monitorId: { in: monitors.map((monitor) => monitor.id) }, checkedAt: { gte: since } },
    select: { monitorId: true, status: true, responseTime: true },
  });

  return {
    total,
    monitors: monitors.map((monitor) => mapMonitor(monitor, checks)),
  };
}

export async function getPublicIncidents(
  page: number,
  pageSize: number,
): Promise<{ incidents: PublicIncidentDto[]; total: number }> {
  const where: Prisma.IncidentWhereInput = {
    monitor: { isActive: true, displayPublicly: true },
    OR: [{ status: "ACTIVE" }, { resolvedAt: { not: null } }],
  };

  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      include: { monitor: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, incidents: incidents.map(mapIncident) };
}

export async function getPublicResponseSeries(range: HistoryRange, maxPoints = 16) {
  const checks = await prisma.monitorCheck.findMany({
    where: {
      checkedAt: { gte: rangeToStartDate(range) },
      monitor: { isActive: true, displayPublicly: true },
    },
    orderBy: { checkedAt: "asc" },
    take: 500,
    select: { checkedAt: true, status: true, responseTime: true },
  });
  return buildResponseTimeSeries(checks, maxPoints);
}

export async function getPublicMonitorHistory(
  monitorId: string,
  range: HistoryRange,
): Promise<MonitorHistoryDto | null> {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, isActive: true, displayPublicly: true },
  });
  if (!monitor) return null;

  const checks = await prisma.monitorCheck.findMany({
    where: { monitorId, checkedAt: { gte: rangeToStartDate(range) } },
    orderBy: { checkedAt: "asc" },
    take: HISTORY_LIMIT,
  });

  return {
    monitorId,
    range,
    points: checks.map((check) => ({
      checkedAt: check.checkedAt.toISOString(),
      status: check.status,
      statusCode: check.statusCode,
      responseTime: check.responseTime,
    })),
    totalChecks: checks.length,
    uptimePercentage: calculateUptime(checks),
    averageResponseTimeMs: calculateAverageResponseTime(checks),
  };
}

function mapMonitor(
  monitor: Monitor,
  checks: Array<{ monitorId: string; status: MonitorStatusValue; responseTime: number }>,
): PublicMonitorDto {
  const monitorChecks = checks.filter((check) => check.monitorId === monitor.id);
  return {
    id: monitor.id,
    name: monitor.name,
    description: monitor.description,
    currentStatus: monitor.currentStatus,
    lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
    lastResponseTime: monitor.lastResponseTime,
    uptimePercentage: calculateUptime(monitorChecks),
    isActive: monitor.isActive,
  };
}

function mapIncident(incident: IncidentWithMonitor): PublicIncidentDto {
  return {
    id: incident.id,
    monitorId: incident.monitorId,
    monitorName: incident.monitor.name,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
  };
}

export function mapMonitorStatus(value: string): MonitorStatusValue {
  return value === "UP" || value === "DOWN" ? value : "UNKNOWN";
}
