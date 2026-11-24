import { describe, expect, it } from "vitest";

import { monitorWriteSchema, paginationQuerySchema } from "@/lib/monitoring/schemas";

const validMonitor = {
  name: "Public API",
  description: "Health endpoint",
  url: "https://api.example.com/health",
  method: "GET",
  expectedStatus: 200,
  intervalMinutes: 5,
  timeoutSeconds: 10,
  isActive: true,
  displayPublicly: true,
};

describe("monitoring schemas", () => {
  it("accepts valid monitor input", () => {
    expect(monitorWriteSchema.safeParse(validMonitor).success).toBe(true);
  });

  it("rejects invalid monitor input", () => {
    expect(monitorWriteSchema.safeParse({ ...validMonitor, expectedStatus: 700 }).success).toBe(false);
    expect(monitorWriteSchema.safeParse({ ...validMonitor, method: "TRACE" }).success).toBe(false);
    expect(
      monitorWriteSchema.safeParse({ ...validMonitor, unexpected: true }).success,
    ).toBe(false);
  });

  it("coerces and bounds pagination values", () => {
    expect(paginationQuerySchema.parse({ page: "2", pageSize: "10" })).toEqual({
      page: 2,
      pageSize: 10,
    });
    expect(paginationQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
