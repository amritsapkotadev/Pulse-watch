import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import {
  calculateIncidentAnalytics,
  createCheckStatsFromCounts,
  formatAnalyticsBucketLabel,
  getAnalyticsBounds,
  sortMonitorSummaries,
  type AnalyticsIncidentRecord,
  type AnalyticsMonitorRecord,
  type CheckCounts,
  type ResponseSampleStats,
} from "@/lib/monitoring/analytics";
import type {
  AnalyticsBucketDto,
  AnalyticsIncidentsDto,
  AnalyticsMonitorsDto,
  AnalyticsOverviewDto,
  AnalyticsRange,
  AnalyticsResponseTimeDto,
  AnalyticsSort,
  AnalyticsUptimeDto,
  IncidentSeverityValue,
  IncidentStatusValue,
  MonitorAnalyticsDto,
  MonitorStatusValue,
} from "@/lib/monitoring/types";

type IncidentRow = Prisma.IncidentGetPayload<{
  include: { monitor: { select: { name: true } } };
}>;

interface TrendRow {
  bucket: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
}

interface StatusGroupRow {
  monitorId: string;
  status: string;
  _count: { _all: number };
}

interface ResponseGroupRow {
  monitorId: string;
  _count: { _all: number };
  _avg: { responseTime: number | null };
  _min: { responseTime: number | null };
  _max: { responseTime: number | null };
}

const emptyResponseStats: ResponseSampleStats = {
  responseSampleCount: 0,
  averageResponseTimeMs: null,
  minResponseTimeMs: null,
  maxResponseTimeMs: null,
};

export async function getAnalyticsOverview(
  range: AnalyticsRange,
  now = new Date(),
): Promise<AnalyticsOverviewDto> {
  const bounds = getAnalyticsBounds(range, now);
  const monitors = await getPublicMonitors();
  const monitorIds = monitors.map((monitor) => monitor.id);
  const [aggregates, incidents, latestCheck] = await Promise.all([
    fetchAggregates(monitorIds, bounds),
    fetchIncidents(monitorIds, bounds),
    fetchLatestCheck(monitorIds, bounds),
  ]);

  const stats = createCheckStatsFromCounts(
    sumCounts(aggregates.counts),
    combineResponses(aggregates.responses),
  );
  const incidentStats = calculateIncidentAnalytics(toIncidentRecords(incidents), bounds, now);

  return {
    range,
    generatedAt: now.toISOString(),
    latestCheckAt: latestCheck ? latestCheck.toISOString() : null,
    stats: {
      totalMonitors: monitors.length,
      operationalMonitors: monitors.filter((monitor) => normalizeStatus(monitor.currentStatus) === "UP").length,
      downMonitors: monitors.filter((monitor) => normalizeStatus(monitor.currentStatus) === "DOWN").length,
      unknownMonitors: monitors.filter((monitor) => normalizeStatus(monitor.currentStatus) === "UNKNOWN").length,
      monitorsWithHistory: [...aggregates.counts.values()].filter((counts) => counts.totalChecks > 0).length,
      ...stats,
      totalIncidents: incidentStats.total,
      mttrMs: incidentStats.mttrMs,
      longestOutageMs: incidentStats.longestOutageMs,
    },
  };
}

export async function getAnalyticsUptime(
  range: AnalyticsRange,
  now = new Date(),
): Promise<AnalyticsUptimeDto> {
  const bounds = getAnalyticsBounds(range, now);
  const monitors = await getPublicMonitors();
  const monitorIds = monitors.map((monitor) => monitor.id);
  const [aggregates, trend] = await Promise.all([
    fetchAggregates(monitorIds, bounds),
    fetchTrendBuckets(monitorIds, bounds, range),
  ]);
  const overall = createCheckStatsFromCounts(
    sumCounts(aggregates.counts),
    combineResponses(aggregates.responses),
  );

  return {
    range,
    generatedAt: now.toISOString(),
    overall: {
      totalChecks: overall.totalChecks,
      successfulChecks: overall.successfulChecks,
      failedChecks: overall.failedChecks,
      uptimePercentage: overall.uptimePercentage,
      hasHistory: overall.totalChecks > 0,
    },
    perMonitor: buildSummaries(monitors, aggregates),
    trend,
  };
}

export async function getAnalyticsResponseTime(
  range: AnalyticsRange,
  now = new Date(),
): Promise<AnalyticsResponseTimeDto> {
  const bounds = getAnalyticsBounds(range, now);
  const monitors = await getPublicMonitors();
  const monitorIds = monitors.map((monitor) => monitor.id);
  const [aggregates, trend] = await Promise.all([
    fetchAggregates(monitorIds, bounds),
    fetchTrendBuckets(monitorIds, bounds, range),
  ]);

  return {
    range,
    generatedAt: now.toISOString(),
    summary: combineResponses(aggregates.responses),
    trend,
    perMonitor: buildSummaries(monitors, aggregates),
  };
}

export async function getAnalyticsIncidents(
  range: AnalyticsRange,
  page: number,
  pageSize: number,
  now = new Date(),
): Promise<AnalyticsIncidentsDto> {
  const bounds = getAnalyticsBounds(range, now);
  const monitors = await getPublicMonitors();
  const monitorIds = monitors.map((monitor) => monitor.id);
  const [aggregates, incidentRows] = await Promise.all([
    fetchAggregates(monitorIds, bounds),
    fetchIncidents(monitorIds, bounds),
  ]);
  const incidentStats = calculateIncidentAnalytics(toIncidentRecords(incidentRows), bounds, now);
  const mostUnreliable = buildSummaries(monitors, aggregates)
    .filter((monitor) => monitor.hasHistory)
    .sort((left, right) =>
      right.failureRate - left.failureRate || right.failedChecks - left.failedChecks,
    )
    .slice(0, 5);
  const start = (page - 1) * pageSize;

  return {
    range,
    generatedAt: now.toISOString(),
    total: incidentStats.total,
    mttrMs: incidentStats.mttrMs,
    longestOutageMs: incidentStats.longestOutageMs,
    mostUnreliable,
    incidents: incidentStats.incidents.slice(start, start + pageSize),
    page,
    pageSize,
  };
}

export async function getAnalyticsMonitors(
  range: AnalyticsRange,
  page: number,
  pageSize: number,
  sort: AnalyticsSort,
  order: "asc" | "desc",
  search: string | undefined,
  now = new Date(),
): Promise<AnalyticsMonitorsDto> {
  const bounds = getAnalyticsBounds(range, now);
  const monitors = await getPublicMonitors();
  const aggregates = await fetchAggregates(
    monitors.map((monitor) => monitor.id),
    bounds,
  );
  const needle = search?.toLowerCase();
  const filtered = buildSummaries(monitors, aggregates).filter(
    (monitor) =>
      !needle ||
      monitor.name.toLowerCase().includes(needle) ||
      monitor.description.toLowerCase().includes(needle),
  );
  const sorted = sortMonitorSummaries(filtered, sort, order);
  const start = (page - 1) * pageSize;

  return {
    range,
    generatedAt: now.toISOString(),
    total: sorted.length,
    monitors: sorted.slice(start, start + pageSize),
    page,
    pageSize,
  };
}

export async function getPublicMonitorAnalytics(
  monitorId: string,
  range: AnalyticsRange,
  now = new Date(),
): Promise<MonitorAnalyticsDto | null> {
  const bounds = getAnalyticsBounds(range, now);
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, isActive: true, displayPublicly: true },
    select: {
      id: true,
      name: true,
      description: true,
      currentStatus: true,
      lastCheckedAt: true,
    },
  });
  if (!monitor) return null;

  const [aggregates, incidentRows, trend, lastSuccessful, lastFailed] = await Promise.all([
    fetchAggregates([monitorId], bounds),
    fetchIncidents([monitorId], bounds),
    fetchTrendBuckets([monitorId], bounds, range, monitorId),
    prisma.monitorCheck.findFirst({
      where: { monitorId, status: "UP", checkedAt: { gte: bounds.since, lte: bounds.until } },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.monitorCheck.findFirst({
      where: { monitorId, status: "DOWN", checkedAt: { gte: bounds.since, lte: bounds.until } },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
  ]);

  const stats = createCheckStatsFromCounts(
    countFor(aggregates.counts, monitorId),
    responseFor(aggregates.responses, monitorId),
  );
  const incidentStats = calculateIncidentAnalytics(toIncidentRecords(incidentRows), bounds, now);

  return {
    range,
    generatedAt: now.toISOString(),
    monitor: {
      id: monitor.id,
      name: monitor.name,
      description: monitor.description,
      currentStatus: normalizeStatus(monitor.currentStatus),
      lastCheckedAt: toIsoOrNull(monitor.lastCheckedAt),
    },
    summary: {
      ...stats,
      lastSuccessfulCheck: lastSuccessful?.checkedAt.toISOString() ?? null,
      lastFailedCheck: lastFailed?.checkedAt.toISOString() ?? null,
    },
    trend,
    incidents: incidentStats.incidents,
  };
}

async function getPublicMonitors(): Promise<AnalyticsMonitorRecord[]> {
  const monitors = await prisma.monitor.findMany({
    where: { isActive: true, displayPublicly: true },
    select: {
      id: true,
      name: true,
      description: true,
      currentStatus: true,
      lastCheckedAt: true,
    },
    orderBy: { name: "asc" },
  });
  return monitors;
}

async function fetchAggregates(
  monitorIds: string[],
  bounds: { since: Date; until: Date },
): Promise<{ counts: Map<string, CheckCounts>; responses: Map<string, ResponseSampleStats> }> {
  if (monitorIds.length === 0) {
    return { counts: new Map(), responses: new Map() };
  }

  const where: Prisma.MonitorCheckWhereInput = {
    monitorId: { in: monitorIds },
    checkedAt: { gte: bounds.since, lte: bounds.until },
  };
  const [statusRows, responseRows] = await Promise.all([
    prisma.monitorCheck.groupBy({
      by: ["monitorId", "status"],
      where,
      _count: { _all: true },
    }),
    prisma.monitorCheck.groupBy({
      by: ["monitorId"],
      where: { ...where, status: "UP", responseTime: { gt: 0 } },
      _count: { _all: true },
      _avg: { responseTime: true },
      _min: { responseTime: true },
      _max: { responseTime: true },
    }),
  ]);

  return {
    counts: toCountsMap(statusRows as StatusGroupRow[]),
    responses: toResponseMap(responseRows as ResponseGroupRow[]),
  };
}

async function fetchIncidents(
  monitorIds: string[],
  bounds: { since: Date; until: Date },
): Promise<IncidentRow[]> {
  if (monitorIds.length === 0) return [];
  return prisma.incident.findMany({
    where: {
      monitorId: { in: monitorIds },
      startedAt: { lte: bounds.until },
      OR: [{ resolvedAt: null }, { resolvedAt: { gte: bounds.since } }],
    },
    include: { monitor: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
  });
}

async function fetchLatestCheck(
  monitorIds: string[],
  bounds: { since: Date; until: Date },
): Promise<Date | null> {
  if (monitorIds.length === 0) return null;
  const check = await prisma.monitorCheck.findFirst({
    where: {
      monitorId: { in: monitorIds },
      checkedAt: { gte: bounds.since, lte: bounds.until },
    },
    orderBy: { checkedAt: "desc" },
    select: { checkedAt: true },
  });
  return check?.checkedAt ?? null;
}

async function fetchTrendBuckets(
  monitorIds: string[],
  bounds: { since: Date; until: Date },
  range: AnalyticsRange,
  monitorId?: string,
): Promise<AnalyticsBucketDto[]> {
  if (monitorIds.length === 0) return [];
  const bucketSize = range === "24h" ? "hour" : "day";
  const monitorScope = monitorId ? Prisma.sql`AND mc."monitorId" = ${monitorId}` : Prisma.sql``;
  const rows = await prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      to_char(date_trunc(${bucketSize}, mc."checkedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "bucket",
      COUNT(*)::int AS "totalChecks",
      COUNT(*) FILTER (WHERE mc."status" = 'UP')::int AS "successfulChecks",
      COUNT(*) FILTER (WHERE mc."status" = 'DOWN')::int AS "failedChecks",
      CAST(AVG(mc."responseTime") FILTER (WHERE mc."status" = 'UP' AND mc."responseTime" > 0) AS float8) AS "averageResponseTimeMs",
      CAST(MIN(mc."responseTime") FILTER (WHERE mc."status" = 'UP' AND mc."responseTime" > 0) AS int) AS "minResponseTimeMs",
      CAST(MAX(mc."responseTime") FILTER (WHERE mc."status" = 'UP' AND mc."responseTime" > 0) AS int) AS "maxResponseTimeMs"
    FROM "MonitorCheck" AS mc
    WHERE mc."checkedAt" >= ${bounds.since}
      AND mc."checkedAt" <= ${bounds.until}
      AND EXISTS (
        SELECT 1
        FROM "Monitor" AS m
        WHERE m."id" = mc."monitorId"
          AND m."isActive" = true
          AND m."displayPublicly" = true
      )
      ${monitorScope}
    GROUP BY 1
    ORDER BY 1
  `);

  return rows.map((row) => {
    const determinate = row.successfulChecks + row.failedChecks;
    return {
      bucket: row.bucket,
      label: formatAnalyticsBucketLabel(row.bucket, range),
      totalChecks: row.totalChecks,
      successfulChecks: row.successfulChecks,
      failedChecks: row.failedChecks,
      uptimePercentage: determinate > 0 ? round(row.successfulChecks / determinate) : 0,
      averageResponseTimeMs:
        row.averageResponseTimeMs === null ? null : Math.round(row.averageResponseTimeMs),
      minResponseTimeMs: row.minResponseTimeMs,
      maxResponseTimeMs: row.maxResponseTimeMs,
    };
  });
}

function buildSummaries(
  monitors: AnalyticsMonitorRecord[],
  aggregates: { counts: Map<string, CheckCounts>; responses: Map<string, ResponseSampleStats> },
) {
  return monitors.map((monitor) => {
    const stats = createCheckStatsFromCounts(
      countFor(aggregates.counts, monitor.id),
      responseFor(aggregates.responses, monitor.id),
    );
    return {
      id: monitor.id,
      name: monitor.name,
      description: monitor.description,
      currentStatus: normalizeStatus(monitor.currentStatus),
      lastCheckedAt: toIsoOrNull(monitor.lastCheckedAt),
      ...stats,
      hasHistory: stats.totalChecks > 0,
    };
  });
}

function toCountsMap(rows: StatusGroupRow[]): Map<string, CheckCounts> {
  const counts = new Map<string, CheckCounts>();
  for (const row of rows) {
    const current = counts.get(row.monitorId) ?? {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
    };
    current.totalChecks += row._count._all;
    if (row.status === "UP") current.successfulChecks += row._count._all;
    if (row.status === "DOWN") current.failedChecks += row._count._all;
    counts.set(row.monitorId, current);
  }
  return counts;
}

function toResponseMap(rows: ResponseGroupRow[]): Map<string, ResponseSampleStats> {
  const responses = new Map<string, ResponseSampleStats>();
  for (const row of rows) {
    responses.set(row.monitorId, {
      responseSampleCount: row._count._all,
      averageResponseTimeMs:
        row._avg.responseTime === null ? null : Math.round(row._avg.responseTime),
      minResponseTimeMs: row._min.responseTime,
      maxResponseTimeMs: row._max.responseTime,
    });
  }
  return responses;
}

function countFor(counts: Map<string, CheckCounts>, monitorId: string): CheckCounts {
  return (
    counts.get(monitorId) ?? {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
    }
  );
}

function responseFor(
  responses: Map<string, ResponseSampleStats>,
  monitorId: string,
): ResponseSampleStats {
  return responses.get(monitorId) ?? emptyResponseStats;
}

function sumCounts(counts: Map<string, CheckCounts>): CheckCounts {
  const total: CheckCounts = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
  };
  for (const countsForMonitor of counts.values()) {
    total.totalChecks += countsForMonitor.totalChecks;
    total.successfulChecks += countsForMonitor.successfulChecks;
    total.failedChecks += countsForMonitor.failedChecks;
  }
  return total;
}

function combineResponses(responses: Map<string, ResponseSampleStats>): ResponseSampleStats {
  let responseSampleCount = 0;
  let weightedTotal = 0;
  const minimums: number[] = [];
  const maximums: number[] = [];

  for (const response of responses.values()) {
    if (response.responseSampleCount === 0) continue;
    responseSampleCount += response.responseSampleCount;
    weightedTotal += (response.averageResponseTimeMs ?? 0) * response.responseSampleCount;
    if (response.minResponseTimeMs !== null) minimums.push(response.minResponseTimeMs);
    if (response.maxResponseTimeMs !== null) maximums.push(response.maxResponseTimeMs);
  }

  if (responseSampleCount === 0) return emptyResponseStats;
  return {
    responseSampleCount,
    averageResponseTimeMs: Math.round(weightedTotal / responseSampleCount),
    minResponseTimeMs: minimums.length > 0 ? Math.min(...minimums) : null,
    maxResponseTimeMs: maximums.length > 0 ? Math.max(...maximums) : null,
  };
}

function toIncidentRecords(rows: IncidentRow[]): AnalyticsIncidentRecord[] {
  return rows.map((incident) => ({
    id: incident.id,
    monitorId: incident.monitorId,
    monitorName: incident.monitor.name,
    title: incident.title,
    severity: normalizeSeverity(incident.severity),
    status: normalizeIncidentStatus(incident.status),
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
  }));
}

function normalizeStatus(value: string): MonitorStatusValue {
  return value === "UP" || value === "DOWN" ? value : "UNKNOWN";
}

function normalizeSeverity(value: string): IncidentSeverityValue {
  return value === "WARNING" || value === "CRITICAL" ? value : "INFO";
}

function normalizeIncidentStatus(value: string): IncidentStatusValue {
  return value === "ACTIVE" ? "ACTIVE" : "RESOLVED";
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function round(ratio: number): number {
  return Math.round(ratio * 1000) / 10;
}
