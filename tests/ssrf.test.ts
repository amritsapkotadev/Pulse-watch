import { describe, expect, it } from "vitest";

import { isUnsafeTargetError, validateMonitorTarget } from "@/lib/monitoring/ssrf";
import { RequestExecutionError } from "@/lib/server/request-executor";

describe("monitor target validation", () => {
  it("accepts public HTTP targets", async () => {
    const url = await validateMonitorTarget("https://1.1.1.1/health");
    expect(url.hostname).toBe("1.1.1.1");
  });

  it("rejects localhost and private addresses", async () => {
    await expect(validateMonitorTarget("http://localhost:3000/admin")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
    await expect(validateMonitorTarget("http://127.0.0.1")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
    await expect(validateMonitorTarget("http://10.0.0.5")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
    await expect(validateMonitorTarget("http://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
  });

  it("rejects embedded credentials and unsupported protocols", async () => {
    await expect(validateMonitorTarget("https://user:pass@example.com")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
    await expect(validateMonitorTarget("file:///etc/passwd")).rejects.toBeInstanceOf(
      RequestExecutionError,
    );
  });

  it("identifies unsafe target errors", async () => {
    try {
      await validateMonitorTarget("http://localhost");
    } catch (error) {
      expect(isUnsafeTargetError(error)).toBe(true);
    }
  });
});
