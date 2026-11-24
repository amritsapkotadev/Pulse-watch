import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import { formatAnalyticsBucketLabel } from "@/lib/monitoring/analytics";
import { rangeToStartDate } from "@/lib/monitoring/metrics";
import type {
  IncidentSeverityValue,
  IncidentStatusValue,
  MonitorStatusValue,
} from "@/lib/monitoring/types";
import {
  deriveBucketState,
  deriveOverallState,
  deriveServiceState,
} from "@/lib/status/calculations";
import type {
  StatusIncidentDto,
  StatusIncidentUpdateDto,
  StatusMonitorDto,
  StatusOverviewDto,
  StatusRange,
  StatusSnapshotDto,
  StatusUptimeBucketDto,
} from "@/lib/status/types";

type PublicMonitorRow = {
  id: string;
  name: string;
  description: string;
  currentStatus: string;
  lastCheckedAt: Date | null;
  lastResponseTime: number | null;
};

type IncidentRow = {
  id: string;
  monitorId: string;
  title: string;
  severity: string;
  status: string;
  startedAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  resolvedAt: Date | null;
  monitor: { name: string };
};

type CountRow = {
  monitorId: string;
  status: string;
  _count: { _all: number };
};

type LastSuccessRow = {
  monitorId: string;
  _max: { checkedAt: Date | null };
};

type HistoryRow = {
  monitorId: string;
  bucket: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTimeMs: number | null;
};

interface CheckCounts {
  total: number;
  successful: number;
  failed: number;
}

type CountMap = Map<string, CheckCounts>;

const STATUS_RANGES: StatusRange[] = ["24h", "7d", "30d"];

export async function getStatusSnapshot(
  range: StatusRange,
  now = new Date(),
): Promise<StatusSnapshotDto> {
  const data = await loadStatusData(range, now, true);
  return {
    overview: data.overview,
    monitors: data.monitors,
    incidents: data.incidents.slice(0, 20),
  };
}

export async function getStatusMonitors(
  range: StatusRange,
  now = new Date(),
): Promise<StatusMonitorDto[]> {
  return (await loadStatusData(range, now, false)).monitors;
}

export async function getStatusOverview(
  range: StatusRange,
  now = new Date(),
): Promise<StatusOverviewDto> {
  return (await loadStatusData(range, now, false)).overview;
}

export async function getStatusIncidents(
  range: StatusRange,
  page: number,
  pageSize: number,
  now = new Date(),
): Promise<{ incidents: StatusIncidentDto[]; total: number }> {
  const where = incidentWhere(range, now);
  const [total, rows] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      select: incidentSelect,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { incidents: rows.map((row) => mapIncident(row, now)), total };
}

async function loadStatusData(
  range: StatusRange,
  now: Date,
  includeIncidents: boolean,
): Promise<{
  overview: StatusOverviewDto;
  monitors: StatusMonitorDto[];
  incidents: StatusIncidentDto[];
}> {
  const monitors = await prisma.monitor.findMany({
    where: { isActive: true, displayPublicly: true },
    select: {
      id: true,
      name: true,
      description: true,
      currentStatus: true,
      lastCheckedAt: true,
      lastResponseTime: true,
    },
    orderBy: { name: "asc" },
  });
  const monitorIds = monitors.map((monitor) => monitor.id);
  const since24h = rangeToStartDate("24h", now);
  const [countsByRange, responseAggregate, lastSuccessRows, historyRows, incidentRows] =
    await Promise.all([
      fetchCountsByRange(monitorIds, now),
      prisma.monitorCheck.aggregate({
        where: {
          monitorId: { in: monitorIds },
          checkedAt: { gte: since24h, lte: now },
          status: "UP",
          responseTime: { gt: 0 },
        },
        _avg: { responseTime: true },
        _count: { _all: true },
      }),
      prisma.monitorCheck.groupBy({
        by: ["monitorId"],
        where: {
          monitorId: { in: monitorIds },
          status: "UP",
        },
        _max: { checkedAt: true },
      }),
      fetchHistoryRows(range, now),
      includeIncidents
        ? prisma.incident.findMany({
            where: incidentWhere("30d", now),
            select: incidentSelect,
            orderBy: { startedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([] as IncidentRow[]),
    ]);

  const lastSuccess = new Map(
    (lastSuccessRows as LastSuccessRow[]).map((row) => [row.monitorId, row._max.checkedAt]),
  );
  const history = groupHistory(historyRows, range);
  const monitorDtos = monitors.map((monitor) =>
    mapMonitor(
      monitor,
      countsByRange,
      lastSuccess.get(monitor.id) ?? null,
      history.get(monitor.id) ?? [],
    ),
  );
  const totalCounts = sumCounts(countsByRange["24h"]);
  const latestCheckAt = monitors.reduce<Date | null>((latest, monitor) => {
    if (!monitor.lastCheckedAt) return latest;
    return !latest || monitor.lastCheckedAt > latest ? monitor.lastCheckedAt : latest;
  }, null);
  const overview: StatusOverviewDto = {
    status: deriveOverallState(monitorDtos.map((monitor) => ({ status: monitor.status }))),
    generatedAt: now.toISOString(),
    latestCheckAt: toIso(latestCheckAt),
    range,
    counts: {
      total: monitorDtos.length,
      operational: monitorDtos.filter((monitor) => monitor.status === "UP").length,
      degraded: monitorDtos.filter((monitor) => monitor.status === "DEGRADED").length,
      down: monitorDtos.filter((monitor) => monitor.status === "DOWN").length,
      noData: monitorDtos.filter((monitor) => monitor.status === "UNKNOWN").length,
    },
    uptimePercentage: uptimePercentage(totalCounts),
    averageResponseTimeMs:
      responseAggregate._count._all > 0 && responseAggregate._avg.responseTime !== null
        ? Math.round(responseAggregate._avg.responseTime)
        : null,
    activeIncidents: incidentRows.filter((incident) => incident.status === "ACTIVE").length,
  };

  return {
    overview,
    monitors: monitorDtos,
    incidents: incidentRows.map((incident) => mapIncident(incident, now)),
  };
}

async function fetchCountsByRange(
  monitorIds: string[],
  now: Date,
): Promise<Record<StatusRange, CountMap>> {
  const result = {} as Record<StatusRange, CountMap>;
  const rowsByRange = await Promise.all(
    STATUS_RANGES.map((range) =>
      prisma.monitorCheck.groupBy({
        by: ["monitorId", "status"],
        where: {
          monitorId: { in: monitorIds },
          checkedAt: { gte: rangeToStartDate(range, now), lte: now },
        },
        _count: { _all: true },
      }),
    ),
  );
  STATUS_RANGES.forEach((range, index) => {
    result[range] = toCountMap(rowsByRange[index] as CountRow[]);
  });
  return result;
}

async function fetchHistoryRows(range: StatusRange, now: Date): Promise<HistoryRow[]> {
  const bucketSize = range === "24h" ? "hour" : "day";
  return prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
    WITH bounds AS (
      SELECT ${rangeToStartDate(range, now)}::timestamptz AS since,
             ${now}::timestamptz AS until,
             ${bucketSize}::text AS bucket_size
    ),
    buckets AS (
      SELECT generate_series(
        date_trunc(bucket_size, since AT TIME ZONE 'UTC'),
        date_trunc(bucket_size, until AT TIME ZONE 'UTC'),
        CASE WHEN bucket_size = 'hour' THEN interval '1 hour' ELSE interval '1 day' END
      ) AS bucket
      FROM bounds
    ),
    series AS (
      SELECT m."id" AS "monitorId", b.bucket
      FROM "Monitor" m
      CROSS JOIN buckets b
      WHERE m."isActive" = true AND m."displayPublicly" = true
    )
    SELECT
      s."monitorId" AS "monitorId",
      to_char(s.bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "bucket",
      COUNT(mc."id")::int AS "totalChecks",
      COUNT(mc."id") FILTER (WHERE mc."status" = 'UP')::int AS "successfulChecks",
      COUNT(mc."id") FILTER (WHERE mc."status" = 'DOWN')::int AS "failedChecks",
      CAST(AVG(mc."responseTime") FILTER (
        WHERE mc."status" = 'UP' AND mc."responseTime" > 0
      ) AS float8) AS "averageResponseTimeMs"
    FROM series s
    LEFT JOIN "MonitorCheck" mc
      ON mc."monitorId" = s."monitorId"
      AND mc."checkedAt" >= (SELECT since FROM bounds)
      AND mc."checkedAt" <= (SELECT until FROM bounds)
      AND date_trunc((SELECT bucket_size FROM bounds), mc."checkedAt" AT TIME ZONE 'UTC') = s.bucket
    GROUP BY s."monitorId", s.bucket
    ORDER BY s."monitorId", s.bucket
  `);
}

function mapMonitor(
  monitor: PublicMonitorRow,
  countsByRange: Record<StatusRange, CountMap>,
  lastSuccess: Date | null,
  history: StatusUptimeBucketDto[],
): StatusMonitorDto {
  const counts24h = countsByRange["24h"].get(monitor.id) ?? emptyCounts();
  const status = deriveServiceState(
    normalizeMonitorStatus(monitor.currentStatus),
    counts24h.failed,
    counts24h.total > 0,
  );
  return {
    id: monitor.id,
    name: monitor.name,
    description: monitor.description,
    status,
    lastCheckedAt: toIso(monitor.lastCheckedAt),
    lastResponseTimeMs: monitor.lastResponseTime,
    lastSuccessfulCheckAt: toIso(lastSuccess),
    recentFailures24h: counts24h.failed,
    determinateChecks24h: counts24h.successful + counts24h.failed,
    hasHistory: STATUS_RANGES.some((range) => (countsByRange[range].get(monitor.id)?.total ?? 0) > 0),
    uptime: {
      "24h": uptimePercentage(counts24h),
      "7d": uptimePercentage(countsByRange["7d"].get(monitor.id) ?? emptyCounts()),
      "30d": uptimePercentage(countsByRange["30d"].get(monitor.id) ?? emptyCounts()),
    },
    history,
  };
}

function groupHistory(
  rows: HistoryRow[],
  range: StatusRange,
): Map<string, StatusUptimeBucketDto[]> {
  const grouped = new Map<string, StatusUptimeBucketDto[]>();
  for (const row of rows) {
    const bucket: StatusUptimeBucketDto = {
      bucket: row.bucket,
      label: formatAnalyticsBucketLabel(row.bucket, range),
      state: deriveBucketState(row.successfulChecks, row.failedChecks, row.totalChecks),
      totalChecks: row.totalChecks,
      successfulChecks: row.successfulChecks,
      failedChecks: row.failedChecks,
      uptimePercentage: uptimePercentage({
        total: row.totalChecks,
        successful: row.successfulChecks,
        failed: row.failedChecks,
      }),
      averageResponseTimeMs:
        row.averageResponseTimeMs === null ? null : Math.round(row.averageResponseTimeMs),
    };
    const list = grouped.get(row.monitorId) ?? [];
    list.push(bucket);
    grouped.set(row.monitorId, list);
  }
  return grouped;
}

function toCountMap(rows: CountRow[]): CountMap {
  const counts = new Map<string, CheckCounts>();
  for (const row of rows) {
    const current = counts.get(row.monitorId) ?? emptyCounts();
    current.total += row._count._all;
    if (row.status === "UP") current.successful += row._count._all;
    if (row.status === "DOWN") current.failed += row._count._all;
    counts.set(row.monitorId, current);
  }
  return counts;
}

function sumCounts(counts: CountMap): CheckCounts {
  return [...counts.values()].reduce(
    (total, current) => ({
      total: total.total + current.total,
      successful: total.successful + current.successful,
      failed: total.failed + current.failed,
    }),
    emptyCounts(),
  );
}

function uptimePercentage(counts: CheckCounts): number {
  const determinate = counts.successful + counts.failed;
  if (determinate === 0) return 0;
  return Math.round((counts.successful / determinate) * 1000) / 10;
}

function emptyCounts(): CheckCounts {
  return { total: 0, successful: 0, failed: 0 };
}

const incidentSelect = {
  id: true,
  monitorId: true,
  title: true,
  severity: true,
  status: true,
  startedAt: true,
  lastSeenAt: true,
  occurrenceCount: true,
  resolvedAt: true,
  monitor: { select: { name: true } },
} satisfies Prisma.IncidentSelect;

function incidentWhere(range: StatusRange, now: Date): Prisma.IncidentWhereInput {
  return {
    monitor: { isActive: true, displayPublicly: true },
    startedAt: { gte: rangeToStartDate(range, now), lte: now },
  };
}

function mapIncident(incident: IncidentRow, now: Date): StatusIncidentDto {
  const startedAt = incident.startedAt.getTime();
  const endedAt = Math.max(incident.lastSeenAt.getTime(), incident.resolvedAt?.getTime() ?? now.getTime());
  const updates: StatusIncidentUpdateDto[] = [
    {
      id: `${incident.id}-detected`,
      label: "Detected",
      at: incident.startedAt.toISOString(),
      detail: null,
    },
  ];
  if (incident.lastSeenAt.getTime() > incident.startedAt.getTime()) {
    updates.push({
      id: `${incident.id}-observed`,
      label: "Latest failed check",
      at: incident.lastSeenAt.toISOString(),
      detail: `${incident.occurrenceCount} failed check${incident.occurrenceCount === 1 ? "" : "s"} recorded`,
    });
  }
  if (incident.resolvedAt) {
    updates.push({
      id: `${incident.id}-resolved`,
      label: "Resolved",
      at: incident.resolvedAt.toISOString(),
      detail: null,
    });
  }
  return {
    id: incident.id,
    monitorId: incident.monitorId,
    monitorName: incident.monitor.name,
    title: incident.title,
    severity: normalizeSeverity(incident.severity),
    status: normalizeIncidentStatus(incident.status),
    startedAt: incident.startedAt.toISOString(),
    resolvedAt: toIso(incident.resolvedAt),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    occurrenceCount: incident.occurrenceCount,
    durationMs: Math.max(0, endedAt - startedAt),
    updates,
  };
}

function normalizeMonitorStatus(value: string): MonitorStatusValue {
  return value === "UP" || value === "DOWN" ? value : "UNKNOWN";
}

function normalizeSeverity(value: string): IncidentSeverityValue {
  return value === "WARNING" || value === "CRITICAL" ? value : "INFO";
}

function normalizeIncidentStatus(value: string): IncidentStatusValue {
  return value === "ACTIVE" ? "ACTIVE" : "RESOLVED";
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
