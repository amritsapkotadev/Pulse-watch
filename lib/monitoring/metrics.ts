import type { AnalyticsRange, MonitorStatusValue } from "@/lib/monitoring/types";

export interface MetricCheck {
  status: MonitorStatusValue;
  responseTime: number;
  checkedAt: string | Date;
}

export function calculateUptime(checks: Array<Pick<MetricCheck, "status">>): number {
  const determinate = checks.filter((check) => check.status === "UP" || check.status === "DOWN");
  if (determinate.length === 0) return 0;
  const up = determinate.filter((check) => check.status === "UP").length;
  return Math.round((up / determinate.length) * 1000) / 10;
}

export function calculateAverageResponseTime(checks: Array<Pick<MetricCheck, "responseTime">>): number {
  const values = checks
    .map((check) => check.responseTime)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function rangeToStartDate(range: AnalyticsRange, now = new Date()): Date {
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : range === "30d" ? 24 * 30 : 24 * 90;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function buildResponseTimeSeries(
  checks: MetricCheck[],
  maxPoints = 16,
): Array<{ label: string; responseTime: number; status: MonitorStatusValue }> {
  if (checks.length === 0) return [];

  const sorted = [...checks].sort((a, b) => toTime(a.checkedAt) - toTime(b.checkedAt));
  const groupSize = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const series: Array<{ label: string; responseTime: number; status: MonitorStatusValue }> = [];

  for (let index = 0; index < sorted.length; index += groupSize) {
    const group = sorted.slice(index, index + groupSize);
    const timestamp = new Date(toTime(group[group.length - 1].checkedAt));
    series.push({
      label: timestamp.toISOString().slice(5, 16).replace("T", " "),
      responseTime: calculateAverageResponseTime(group),
      status: group.some((check) => check.status === "DOWN")
        ? "DOWN"
        : group.some((check) => check.status === "UNKNOWN")
          ? "UNKNOWN"
          : "UP",
    });
  }

  return series;
}

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
