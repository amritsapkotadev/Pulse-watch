import { rangeToStartDate } from "@/lib/monitoring/metrics";
import type {
  AnalyticsBucketDto,
  AnalyticsIncidentDto,
  AnalyticsMonitorSummaryDto,
  AnalyticsRange,
  AnalyticsSort,
  IncidentSeverityValue,
  IncidentStatusValue,
  MonitorStatusValue,
} from "@/lib/monitoring/types";

export interface AnalyticsBounds {
  since: Date;
  until: Date;
}

export interface AnalyticsCheckRecord {
  monitorId: string;
  status: MonitorStatusValue;
  responseTime: number;
  checkedAt: Date | string;
}

export interface AnalyticsIncidentRecord {
  id: string;
  monitorId: string;
  monitorName: string;
  title: string;
  severity: IncidentSeverityValue;
  status: IncidentStatusValue;
  startedAt: Date | string;
  resolvedAt: Date | string | null;
}

export interface AnalyticsMonitorRecord {
  id: string;
  name: string;
  description: string;
  currentStatus: string;
  lastCheckedAt: Date | string | null;
}

export interface CheckStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number;
  failureRate: number;
  responseSampleCount: number;
  averageResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
}

export type ResponseSampleStats = Pick<
  CheckStats,
  | "responseSampleCount"
  | "averageResponseTimeMs"
  | "minResponseTimeMs"
  | "maxResponseTimeMs"
>;

export interface CheckCounts {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
}

export function getAnalyticsBounds(range: AnalyticsRange, now = new Date()): AnalyticsBounds {
  return { since: rangeToStartDate(range, now), until: now };
}

export function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function filterChecksInRange(
  checks: AnalyticsCheckRecord[],
  bounds: AnalyticsBounds,
): AnalyticsCheckRecord[] {
  return checks.filter((check) => {
    const time = toTimestamp(check.checkedAt);
    return time >= bounds.since.getTime() && time <= bounds.until.getTime();
  });
}

export function calculateFailureRate(checks: Array<Pick<AnalyticsCheckRecord, "status">>): number {
  const determinate = checks.filter(
    (check) => check.status === "UP" || check.status === "DOWN",
  );
  if (determinate.length === 0) return 0;
  const failed = determinate.filter((check) => check.status === "DOWN").length;
  return round(failed / determinate.length);
}

export function calculateResponseStats(
  checks: Array<Pick<AnalyticsCheckRecord, "status" | "responseTime">>,
): ResponseSampleStats {
  const samples = checks
    .filter((check) => check.status === "UP")
    .map((check) => check.responseTime)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (samples.length === 0) {
    return {
      responseSampleCount: 0,
      averageResponseTimeMs: null,
      minResponseTimeMs: null,
      maxResponseTimeMs: null,
    };
  }

  return {
    responseSampleCount: samples.length,
    averageResponseTimeMs: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
    minResponseTimeMs: Math.min(...samples),
    maxResponseTimeMs: Math.max(...samples),
  };
}

export function createCheckStatsFromCounts(
  counts: CheckCounts,
  response: ResponseSampleStats,
): CheckStats {
  const determinate = counts.successfulChecks + counts.failedChecks;
  return {
    ...counts,
    uptimePercentage: determinate > 0 ? round(counts.successfulChecks / determinate) : 0,
    failureRate: determinate > 0 ? round(counts.failedChecks / determinate) : 0,
    ...response,
  };
}

export function calculateCheckStats(checks: AnalyticsCheckRecord[]): CheckStats {
  return createCheckStatsFromCounts(
    {
      totalChecks: checks.length,
      successfulChecks: checks.filter((check) => check.status === "UP").length,
      failedChecks: checks.filter((check) => check.status === "DOWN").length,
    },
    calculateResponseStats(checks),
  );
}

export function formatAnalyticsBucketLabel(bucket: string, range: AnalyticsRange): string {
  return range === "24h"
    ? `${bucket.slice(5, 10)} ${bucket.slice(11, 16)} UTC`
    : `${bucket.slice(5, 10)} UTC`;
}

export function buildAnalyticsBuckets(
  checks: AnalyticsCheckRecord[],
  range: AnalyticsRange,
  bounds: AnalyticsBounds,
): AnalyticsBucketDto[] {
  const bucketSize = range === "24h" ? "hour" : "day";
  const groups = new Map<string, AnalyticsCheckRecord[]>();

  for (const check of filterChecksInRange(checks, bounds)) {
    const bucket = bucketKey(check.checkedAt, bucketSize);
    const group = groups.get(bucket);
    if (group) group.push(check);
    else groups.set(bucket, [check]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, group]) => ({
      bucket,
      label: formatAnalyticsBucketLabel(bucket, range),
      ...calculateCheckStats(group),
    }));
}

export function calculateIncidentAnalytics(
  incidents: AnalyticsIncidentRecord[],
  bounds: AnalyticsBounds,
  now = new Date(),
): { total: number; mttrMs: number | null; longestOutageMs: number | null; incidents: AnalyticsIncidentDto[] } {
  const related = incidents.filter((incident) => {
    const startedAt = toTimestamp(incident.startedAt);
    const endedAt = incident.resolvedAt ? toTimestamp(incident.resolvedAt) : now.getTime();
    return startedAt <= bounds.until.getTime() && endedAt >= bounds.since.getTime();
  });

  const enriched = related
    .map((incident) => {
      const startedAt = toTimestamp(incident.startedAt);
      const endedAt = incident.resolvedAt ? toTimestamp(incident.resolvedAt) : now.getTime();
      const overlapStart = Math.max(startedAt, bounds.since.getTime());
      const overlapEnd = Math.min(endedAt, bounds.until.getTime());
      return {
        id: incident.id,
        monitorId: incident.monitorId,
        monitorName: incident.monitorName,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        startedAt: new Date(startedAt).toISOString(),
        resolvedAt: incident.resolvedAt ? new Date(endedAt).toISOString() : null,
        durationMs: Math.max(0, endedAt - startedAt),
        overlapMs: Math.max(0, overlapEnd - overlapStart),
      } satisfies AnalyticsIncidentDto;
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

  const resolved = enriched.filter((incident) => incident.resolvedAt);
  return {
    total: enriched.length,
    mttrMs:
      resolved.length > 0
        ? Math.round(resolved.reduce((sum, incident) => sum + incident.durationMs, 0) / resolved.length)
        : null,
    longestOutageMs: enriched.reduce((longest, incident) => Math.max(longest, incident.overlapMs), 0),
    incidents: enriched,
  };
}

export function toPublicMonitorSummary(
  monitor: AnalyticsMonitorRecord,
  checks: AnalyticsCheckRecord[],
): AnalyticsMonitorSummaryDto {
  const stats = calculateCheckStats(checks);
  return {
    id: monitor.id,
    name: monitor.name,
    description: monitor.description,
    currentStatus:
      monitor.currentStatus === "UP" || monitor.currentStatus === "DOWN"
        ? monitor.currentStatus
        : "UNKNOWN",
    lastCheckedAt: toIsoOrNull(monitor.lastCheckedAt),
    ...stats,
    hasHistory: stats.totalChecks > 0,
  };
}

export function sortMonitorSummaries(
  monitors: AnalyticsMonitorSummaryDto[],
  sort: AnalyticsSort,
  order: "asc" | "desc",
): AnalyticsMonitorSummaryDto[] {
  const direction = order === "asc" ? 1 : -1;
  return [...monitors].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name) * direction;
    const leftValue = left[sort];
    const rightValue = right[sort];
    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return (leftValue - rightValue) * direction;
  });
}

function bucketKey(value: Date | string, bucketSize: "hour" | "day"): string {
  const date = new Date(toTimestamp(value));
  if (bucketSize === "hour") date.setUTCMinutes(0, 0, 0);
  else date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  const timestamp = toTimestamp(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function round(ratio: number): number {
  return Math.round(ratio * 1000) / 10;
}
