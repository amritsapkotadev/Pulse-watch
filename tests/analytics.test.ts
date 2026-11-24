import { describe, expect, it } from "vitest";

import {
  buildAnalyticsBuckets,
  calculateCheckStats,
  calculateFailureRate,
  calculateIncidentAnalytics,
  calculateResponseStats,
  filterChecksInRange,
  getAnalyticsBounds,
  sortMonitorSummaries,
  toPublicMonitorSummary,
  type AnalyticsCheckRecord,
} from "@/lib/monitoring/analytics";
import { analyticsRangeSchema } from "@/lib/monitoring/types";

const now = new Date("2026-11-24T12:00:00.000Z");
const bounds = getAnalyticsBounds("24h", now);

function check(overrides: Partial<AnalyticsCheckRecord> = {}): AnalyticsCheckRecord {
  return {
    monitorId: "monitor-1",
    status: "UP",
    responseTime: 120,
    checkedAt: new Date("2026-11-24T11:00:00.000Z"),
    ...overrides,
  };
}

describe("analytics calculations", () => {
  it("returns empty states instead of inventing uptime or response times", () => {
    const stats = calculateCheckStats([]);
    expect(stats.totalChecks).toBe(0);
    expect(stats.uptimePercentage).toBe(0);
    expect(stats.failureRate).toBe(0);
    expect(stats.averageResponseTimeMs).toBeNull();
    expect(stats.minResponseTimeMs).toBeNull();
    expect(stats.maxResponseTimeMs).toBeNull();
    expect(calculateFailureRate([{ status: "UNKNOWN" }])).toBe(0);
  });

  it("calculates uptime and failure rate from determinate checks only", () => {
    const stats = calculateCheckStats([
      check({ status: "UP" }),
      check({ status: "UP" }),
      check({ status: "DOWN", responseTime: 0 }),
      check({ status: "UNKNOWN" }),
    ]);
    expect(stats.totalChecks).toBe(4);
    expect(stats.successfulChecks).toBe(2);
    expect(stats.failedChecks).toBe(1);
    expect(stats.uptimePercentage).toBe(66.7);
    expect(stats.failureRate).toBe(33.3);
  });

  it("uses only successful measured responses for response-time statistics", () => {
    const stats = calculateResponseStats([
      { status: "UP", responseTime: 100 },
      { status: "UP", responseTime: 300 },
      { status: "DOWN", responseTime: 0 },
      { status: "UP", responseTime: 0 },
    ]);
    expect(stats.responseSampleCount).toBe(2);
    expect(stats.averageResponseTimeMs).toBe(200);
    expect(stats.minResponseTimeMs).toBe(100);
    expect(stats.maxResponseTimeMs).toBe(300);
  });

  it("filters checks outside the selected UTC range", () => {
    const checks = [
      check({ checkedAt: new Date("2026-11-23T11:59:59.000Z") }),
      check({ checkedAt: new Date("2026-11-23T12:00:00.000Z") }),
      check({ checkedAt: new Date("2026-11-24T12:00:00.000Z") }),
      check({ checkedAt: new Date("2026-11-24T12:00:01.000Z") }),
    ];
    expect(filterChecksInRange(checks, bounds)).toHaveLength(2);
  });

  it("builds hourly buckets for 24h without emitting empty periods", () => {
    const buckets = buildAnalyticsBuckets(
      [
        check({ checkedAt: new Date("2026-11-24T10:05:00.000Z"), responseTime: 100 }),
        check({ checkedAt: new Date("2026-11-24T10:45:00.000Z"), responseTime: 200 }),
        check({ checkedAt: new Date("2026-11-24T11:05:00.000Z"), status: "DOWN", responseTime: 0 }),
      ],
      "24h",
      bounds,
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0].bucket).toBe("2026-11-24T10:00:00.000Z");
    expect(buckets[0].label).toBe("11-24 10:00 UTC");
    expect(buckets[0].averageResponseTimeMs).toBe(150);
    expect(buckets[1].failedChecks).toBe(1);
  });

  it("builds daily buckets for 7d ranges", () => {
    const weekly = getAnalyticsBounds("7d", now);
    const buckets = buildAnalyticsBuckets(
      [
        check({ checkedAt: new Date("2026-11-22T08:00:00.000Z") }),
        check({ checkedAt: new Date("2026-11-24T08:00:00.000Z") }),
      ],
      "7d",
      weekly,
    );
    expect(buckets.map((bucket) => bucket.bucket)).toEqual([
      "2026-11-22T00:00:00.000Z",
      "2026-11-24T00:00:00.000Z",
    ]);
    expect(buckets[0].label).toBe("11-22 UTC");
  });

  it("calculates incident duration, clipped outage, and MTTR from resolved incidents only", () => {
    const result = calculateIncidentAnalytics(
      [
        {
          id: "incident-1",
          monitorId: "monitor-1",
          monitorName: "API",
          title: "API is down",
          severity: "WARNING",
          status: "RESOLVED",
          startedAt: new Date("2026-11-23T10:00:00.000Z"),
          resolvedAt: new Date("2026-11-23T14:00:00.000Z"),
        },
        {
          id: "incident-2",
          monitorId: "monitor-1",
          monitorName: "API",
          title: "API is down again",
          severity: "CRITICAL",
          status: "ACTIVE",
          startedAt: new Date("2026-11-24T11:00:00.000Z"),
          resolvedAt: null,
        },
      ],
      bounds,
      now,
    );
    expect(result.total).toBe(2);
    expect(result.mttrMs).toBe(4 * 60 * 60 * 1000);
    expect(result.longestOutageMs).toBe(2 * 60 * 60 * 1000);
    expect(result.incidents[0].id).toBe("incident-2");
    expect(result.incidents[1].durationMs).toBe(4 * 60 * 60 * 1000);
  });

  it("excludes private monitor fields from public summaries", () => {
    const monitor = {
      id: "monitor-1",
      name: "Public API",
      description: "Health endpoint",
      currentStatus: "UP",
      lastCheckedAt: new Date("2026-11-24T11:00:00.000Z"),
      url: "https://internal.example/admin",
      headers: [{ key: "authorization", value: "secret" }],
    };
    const summary = toPublicMonitorSummary(monitor, [check()]);
    expect(summary.name).toBe("Public API");
    expect(summary).not.toHaveProperty("url");
    expect(summary).not.toHaveProperty("headers");
    expect(summary.hasHistory).toBe(true);
  });

  it("sorts monitors with missing response samples last", () => {
    const monitors = [
      toPublicMonitorSummary(
        { id: "a", name: "A", description: "", currentStatus: "UP", lastCheckedAt: null },
        [],
      ),
      toPublicMonitorSummary(
        { id: "b", name: "B", description: "", currentStatus: "UP", lastCheckedAt: null },
        [check({ responseTime: 100 })],
      ),
    ];
    const sorted = sortMonitorSummaries(monitors, "averageResponseTimeMs", "asc");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("rejects invalid analytics ranges", () => {
    expect(analyticsRangeSchema.safeParse("12h").success).toBe(false);
    expect(analyticsRangeSchema.safeParse("90d").success).toBe(true);
  });
});
