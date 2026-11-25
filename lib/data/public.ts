import "server-only";

import { Prisma, type Monitor } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  buildResponseTimeSeries,
  calculateAverageResponseTime,
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

interface StatusCountRow {
  status: string;
  _count: { _all: number };
}

interface MonitorStatusCountRow extends StatusCountRow {
  monitorId: string;
}

interface ResponseCountRow {
  _count: { _all: number };
  _avg: { responseTime: number | null };
}

export async function getPublicOverview(
  now = new Date(),
): Promise<{
  totalMonitors: number;
  operationalMonitors: number;
  downMonitors: number;
  unknownMonitors: number;
  uptimePercentage: number;
  averageResponseTimeMs: number;
  recentIncidents: PublicIncidentDto[];
}> {
  const since = new Date(now.getTime() - UPTIME_WINDOW_MS);
  const checkWhere: Prisma.MonitorCheckWhereInput = {
    checkedAt: { gte: since, lte: now },
    monitor: { isActive: true, displayPublicly: true },
  };

  const [monitors, statusRows, responseRows, incidents] = await Promise.all([
    prisma.monitor.findMany({
      where: { isActive: true, displayPublicly: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.monitorCheck.groupBy({
      by: ["status"],
      where: checkWhere,
      _count: { _all: true },
    }),
    prisma.monitorCheck.groupBy({
      by: ["status"],
      where: { ...checkWhere, status: "UP", responseTime: { gt: 0 } },
      _count: { _all: true },
      _avg: { responseTime: true },
    }),
    prisma.incident.findMany({
      where: {
        monitor: { isActive: true, displayPublicly: true },
        OR: [
          { status: "ACTIVE" },
          { resolvedAt: { gte: new Date(now.getTime() - 7 * UPTIME_WINDOW_MS) } },
        ],
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
    unknownMonitors: monitors.filter(
      (monitor) => mapMonitorStatus(String(monitor.currentStatus)) === "UNKNOWN",
    ).length,
    uptimePercentage: uptimeFromStatusCounts(statusRows as StatusCountRow[]),
    averageResponseTimeMs: averageFromResponseCounts(responseRows as ResponseCountRow[]),
    recentIncidents: incidents.map(mapIncident),
  };
}

export async function getPublicMonitors(
  page: number,
  pageSize: number,
  now = new Date(),
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

  const monitorIds = monitors.map((monitor) => monitor.id);
  const uptimeByMonitor = monitorIds.length
    ? buildUptimeByMonitor(
        (await prisma.monitorCheck.groupBy({
          by: ["monitorId", "status"],
          where: {
            monitorId: { in: monitorIds },
            checkedAt: { gte: new Date(now.getTime() - UPTIME_WINDOW_MS), lte: now },
          },
          _count: { _all: true },
        })) as unknown as MonitorStatusCountRow[],
      )
    : new Map<string, number>();

  return {
    total,
    monitors: monitors.map((monitor) => mapMonitor(monitor, uptimeByMonitor.get(monitor.id) ?? 0)),
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

export async function getPublicResponseSeries(
  range: HistoryRange,
  maxPoints = 16,
  now = new Date(),
) {
  const rows = await prisma.monitorCheck.findMany({
    where: {
      checkedAt: { gte: rangeToStartDate(range, now), lte: now },
      monitor: { isActive: true, displayPublicly: true },
    },
    orderBy: { checkedAt: "desc" },
    take: HISTORY_LIMIT,
    select: { checkedAt: true, status: true, responseTime: true },
  });
  return buildResponseTimeSeries(rows.reverse(), maxPoints);
}

export async function getPublicMonitorHistory(
  monitorId: string,
  range: HistoryRange,
  now = new Date(),
): Promise<MonitorHistoryDto | null> {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, isActive: true, displayPublicly: true },
  });
  if (!monitor) return null;

  const where: Prisma.MonitorCheckWhereInput = {
    monitorId,
    checkedAt: { gte: rangeToStartDate(range, now), lte: now },
  };
  const [checks, totalChecks] = await Promise.all([
    prisma.monitorCheck.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.monitorCheck.count({ where }),
  ]);
  const points = checks.reverse();

  return {
    monitorId,
    range,
    points: points.map((check) => ({
      checkedAt: check.checkedAt.toISOString(),
      status: check.status,
      statusCode: check.statusCode,
      responseTime: check.responseTime,
    })),
    totalChecks,
    uptimePercentage: uptimeFromStatusCounts(
      points.map((check) => ({ status: String(check.status), _count: { _all: 1 } })),
    ),
    averageResponseTimeMs: calculateAverageResponseTime(points),
  };
}

function mapMonitor(monitor: Monitor, uptimePercentage: number): PublicMonitorDto {
  return {
    id: monitor.id,
    name: monitor.name,
    description: monitor.description,
    currentStatus: mapMonitorStatus(String(monitor.currentStatus)),
    lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
    lastResponseTime: monitor.lastResponseTime,
    uptimePercentage,
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

function uptimeFromStatusCounts(rows: StatusCountRow[]): number {
  let successful = 0;
  let determinate = 0;
  for (const row of rows) {
    const status = mapMonitorStatus(row.status);
    if (status === "UNKNOWN") continue;
    determinate += row._count._all;
    if (status === "UP") successful += row._count._all;
  }
  return determinate === 0 ? 0 : Math.round((successful / determinate) * 1000) / 10;
}

function buildUptimeByMonitor(rows: MonitorStatusCountRow[]): Map<string, number> {
  const grouped = new Map<string, StatusCountRow[]>();
  for (const row of rows) {
    const monitorRows = grouped.get(row.monitorId) ?? [];
    monitorRows.push(row);
    grouped.set(row.monitorId, monitorRows);
  }
  return new Map(
    [...grouped.entries()].map(([monitorId, monitorRows]) => [
      monitorId,
      uptimeFromStatusCounts(monitorRows),
    ]),
  );
}

function averageFromResponseCounts(rows: ResponseCountRow[]): number {
  let samples = 0;
  let total = 0;
  for (const row of rows) {
    const average = row._avg.responseTime;
    if (average === null || !Number.isFinite(average)) continue;
    samples += row._count._all;
    total += average * row._count._all;
  }
  return samples === 0 ? 0 : Math.round(total / samples);
}

export function mapMonitorStatus(value: string): MonitorStatusValue {
  return value === "UP" || value === "DOWN" ? value : "UNKNOWN";
}
