import "server-only";

import { Prisma } from "@/generated/prisma/client";

import {
  getAnalyticsIncidents,
  getAnalyticsOverview,
  getAnalyticsResponseTime,
  getAnalyticsUptime,
} from "@/lib/data/analytics";
import { getStatusSnapshot } from "@/lib/data/status";
import { prisma } from "@/lib/db";
import { rangeToStartDate } from "@/lib/monitoring/metrics";
import type {
  AnalyticsIncidentsDto,
  AnalyticsMonitorSummaryDto,
  AnalyticsRange,
  AnalyticsResponseTimeDto,
  PublicDashboardAnalyticsDto,
  PublicDashboardDto,
  PublicDashboardIncidentDto,
  PublicDashboardMonitorDto,
} from "@/lib/monitoring/types";
import { overallStatusMessage } from "@/lib/status/calculations";

export async function getPublicDashboardData(
  range: AnalyticsRange,
  now = new Date(),
): Promise<PublicDashboardDto> {
  const [overview, uptime, responseTime, status, incidents, p95ResponseTimeMs] = await Promise.all([
    getAnalyticsOverview(range, now),
    getAnalyticsUptime(range, now),
    getAnalyticsResponseTime(range, now),
    getStatusSnapshot("24h", now),
    getAnalyticsIncidents(range, 1, 100, now),
    getP95ResponseTime(range, now),
  ]);

  const uptimeByMonitor = new Map(uptime.perMonitor.map((monitor) => [monitor.id, monitor]));
  const monitors: PublicDashboardMonitorDto[] = status.monitors.map((monitor) => {
    const summary = uptimeByMonitor.get(monitor.id);
    return {
      id: monitor.id,
      name: monitor.name,
      description: monitor.description,
      status: monitor.status,
      lastCheckedAt: monitor.lastCheckedAt,
      lastResponseTimeMs: monitor.lastResponseTimeMs,
      uptimePercentage: summary?.uptimePercentage ?? 0,
      totalChecks: summary?.totalChecks ?? 0,
      failedChecks: summary?.failedChecks ?? 0,
      averageResponseTimeMs: summary?.averageResponseTimeMs ?? null,
    };
  });
  const statusIncidents = new Map(
    status.incidents.map((incident) => [incident.id, incident.occurrenceCount]),
  );
  const publicIncidents: PublicDashboardIncidentDto[] = incidents.incidents.slice(0, 5).map((incident) => ({
    id: incident.id,
    monitorId: incident.monitorId,
    monitorName: incident.monitorName,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationMs: incident.durationMs,
    occurrenceCount: statusIncidents.get(incident.id) ?? 0,
  }));

  return {
    range,
    generatedAt: now.toISOString(),
    latestCheckAt: overview.latestCheckAt,
    status: status.overview.status,
    statusMessage: overallStatusMessage(status.overview.status),
    stats: {
      totalMonitors: status.overview.counts.total,
      operationalMonitors: status.overview.counts.operational,
      degradedMonitors: status.overview.counts.degraded,
      downMonitors: status.overview.counts.down,
      noDataMonitors: status.overview.counts.noData,
      uptimePercentage: uptime.overall.uptimePercentage,
      averageResponseTimeMs: responseTime.summary.averageResponseTimeMs,
      p95ResponseTimeMs,
      totalChecks: uptime.overall.totalChecks,
      failedChecks: uptime.overall.failedChecks,
      activeIncidents: status.overview.activeIncidents,
    },
    uptimeTrend: uptime.trend,
    responseTrend: responseTime.trend,
    analytics: buildDashboardAnalytics(
      incidents,
      uptime.perMonitor,
      responseTime.summary,
      status.overview.activeIncidents,
    ),
    monitors,
    incidents: publicIncidents,
  };
}

function buildDashboardAnalytics(
  incidents: AnalyticsIncidentsDto,
  monitors: AnalyticsMonitorSummaryDto[],
  response: AnalyticsResponseTimeDto["summary"],
  activeIncidents: number,
): PublicDashboardAnalyticsDto {
  const incidentCounts = new Map<string, number>();
  for (const incident of incidents.incidents) {
    incidentCounts.set(
      incident.monitorName,
      (incidentCounts.get(incident.monitorName) ?? 0) + 1,
    );
  }
  const mostAffected = [...incidentCounts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0];
  const slowest = monitors
    .filter((monitor) => monitor.averageResponseTimeMs !== null)
    .sort((left, right) => (right.averageResponseTimeMs ?? 0) - (left.averageResponseTimeMs ?? 0))[0];
  const leastReliable = monitors
    .filter((monitor) => monitor.totalChecks > 0)
    .sort((left, right) => left.uptimePercentage - right.uptimePercentage)[0];

  return {
    totalIncidents: incidents.total,
    activeIncidents,
    resolvedIncidents: Math.max(0, incidents.total - activeIncidents),
    meanTimeToResolveMs: incidents.mttrMs,
    longestOutageMs: incidents.longestOutageMs,
    responseSampleCount: response.responseSampleCount,
    minResponseTimeMs: response.minResponseTimeMs,
    maxResponseTimeMs: response.maxResponseTimeMs,
    mostAffectedMonitor: mostAffected
      ? { name: mostAffected[0], incidentCount: mostAffected[1] }
      : null,
    slowestMonitor: slowest
      ? {
          id: slowest.id,
          name: slowest.name,
          averageResponseTimeMs: slowest.averageResponseTimeMs ?? 0,
        }
      : null,
    leastReliableMonitor: leastReliable
      ? {
          id: leastReliable.id,
          name: leastReliable.name,
          uptimePercentage: leastReliable.uptimePercentage,
        }
      : null,
  };
}

async function getP95ResponseTime(range: AnalyticsRange, now: Date): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ p95: number | null }>>(Prisma.sql`
    SELECT CAST(
      percentile_cont(0.95) WITHIN GROUP (ORDER BY mc."responseTime") AS float8
    ) AS "p95"
    FROM "MonitorCheck" AS mc
    WHERE mc."checkedAt" >= ${rangeToStartDate(range, now)}
      AND mc."checkedAt" <= ${now}
      AND mc."status" = 'UP'
      AND mc."responseTime" > 0
      AND EXISTS (
        SELECT 1
        FROM "Monitor" AS m
        WHERE m."id" = mc."monitorId"
          AND m."isActive" = true
          AND m."displayPublicly" = true
      )
  `);
  const value = rows[0]?.p95;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
