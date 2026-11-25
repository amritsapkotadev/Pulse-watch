import { describe, expect, it } from "vitest";

import {
  deriveBucketState,
  deriveOverallState,
  deriveServiceState,
  overallStatusMessage,
  statusLabel,
} from "@/lib/status/calculations";
import { statusIncidentsQuerySchema, statusRangeQuerySchema } from "@/lib/monitoring/schemas";

describe("status calculations", () => {
  it("derives service state from current status and recent failures", () => {
    expect(deriveServiceState("DOWN", 0, false)).toBe("DOWN");
    expect(deriveServiceState("UNKNOWN", 0, false)).toBe("UNKNOWN");
    expect(deriveServiceState("UP", 0, false)).toBe("UNKNOWN");
    expect(deriveServiceState("UP", 2, true)).toBe("DEGRADED");
    expect(deriveServiceState("UP", 0, true)).toBe("UP");
  });

  it("derives overall state without inventing operational data", () => {
    expect(deriveOverallState([])).toBe("NO_DATA");
    expect(deriveOverallState([{ status: "UNKNOWN" }])).toBe("NO_DATA");
    expect(deriveOverallState([{ status: "UP" }, { status: "DOWN" }])).toBe("OUTAGE");
    expect(deriveOverallState([{ status: "UP" }, { status: "DEGRADED" }])).toBe("DEGRADED");
    expect(deriveOverallState([{ status: "UP" }, { status: "UNKNOWN" }])).toBe("DEGRADED");
    expect(deriveOverallState([{ status: "UP" }, { status: "UP" }])).toBe("OPERATIONAL");
  });

  it("treats missing uptime buckets as no data", () => {
    expect(deriveBucketState(0, 0, 0)).toBe("UNKNOWN");
    expect(deriveBucketState(1, 0, 1)).toBe("UP");
    expect(deriveBucketState(0, 2, 2)).toBe("DOWN");
    expect(deriveBucketState(3, 1, 4)).toBe("DEGRADED");
  });

  it("uses exact public status messages", () => {
    expect(overallStatusMessage("OPERATIONAL")).toBe("All Systems Operational.");
    expect(overallStatusMessage("DEGRADED")).toBe("Partial System Degradation.");
    expect(overallStatusMessage("OUTAGE")).toBe("Major System Outage.");
    expect(overallStatusMessage("NO_DATA")).toBe("Monitoring Data Delayed.");
  });

  it("uses public-friendly status labels", () => {
    expect(statusLabel("OPERATIONAL")).toBe("Operational");
    expect(statusLabel("DEGRADED")).toBe("Degraded");
    expect(statusLabel("OUTAGE")).toBe("Outage");
    expect(statusLabel("NO_DATA")).toBe("No data");
  });
});

describe("status query schemas", () => {
  it("defaults and validates status ranges", () => {
    expect(statusRangeQuerySchema.parse({}).range).toBe("24h");
    expect(statusRangeQuerySchema.parse({ range: "7d" }).range).toBe("7d");
    expect(statusRangeQuerySchema.safeParse({ range: "12h" }).success).toBe(false);
  });

  it("defaults incident ranges and paginates safely", () => {
    const parsed = statusIncidentsQuerySchema.parse({ page: "2", pageSize: "10" });
    expect(parsed).toEqual({ range: "30d", page: 2, pageSize: 10 });
    expect(statusIncidentsQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
