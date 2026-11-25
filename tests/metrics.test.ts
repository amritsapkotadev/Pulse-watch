import { describe, expect, it } from "vitest";

import {
  buildResponseTimeSeries,
  calculateAverageResponseTime,
  calculateUptime,
  rangeToStartDate,
} from "@/lib/monitoring/metrics";

describe("monitoring metrics", () => {
  it("calculates uptime from determinate checks only", () => {
    expect(
      calculateUptime([
        { status: "UP" },
        { status: "DOWN" },
        { status: "UP" },
        { status: "UNKNOWN" },
      ]),
    ).toBe(66.7);
    expect(calculateUptime([{ status: "UNKNOWN" }])).toBe(0);
  });

  it("calculates average response time and ignores invalid values", () => {
    expect(
      calculateAverageResponseTime([
        { responseTime: 100 },
        { responseTime: 200 },
        { responseTime: -1 },
        { responseTime: 0 },
      ]),
    ).toBe(150);
    expect(calculateAverageResponseTime([])).toBe(0);
  });

  it("converts history ranges into start dates", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(rangeToStartDate("24h", now).toISOString()).toBe("2026-11-23T12:00:00.000Z");
    expect(rangeToStartDate("7d", now).toISOString()).toBe("2026-11-17T12:00:00.000Z");
    expect(rangeToStartDate("30d", now).toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });

  it("builds a bounded response time series", () => {
    const checks = Array.from({ length: 10 }, (_, index) => ({
      status: index === 5 ? ("DOWN" as const) : ("UP" as const),
      responseTime: index * 10,
      checkedAt: new Date(Date.UTC(2026, 10, 24, 0, index)),
    }));
    const series = buildResponseTimeSeries(checks, 4);
    expect(series).toHaveLength(4);
    expect(series.some((point) => point.status === "DOWN")).toBe(true);
  });
});
