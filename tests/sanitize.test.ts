import { describe, expect, it } from "vitest";

import { redactHeaders, sanitizeErrorMessage } from "@/lib/monitoring/sanitize";

describe("monitoring sanitization", () => {
  it("redacts bearer and basic credentials", () => {
    expect(sanitizeErrorMessage("Bearer abc.def-123 failed")).toContain("[REDACTED]");
    expect(sanitizeErrorMessage("Basic dXNlcjpwYXNz failed")).toContain("[REDACTED]");
  });

  it("removes credentials and sensitive query values from URLs", () => {
    const message = "GET https://user:pass@example.com/health?api_key=secret123 failed";
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).not.toContain("user:pass");
    expect(sanitized).not.toContain("secret123");
    expect(sanitized).toContain("REDACTED");
  });

  it("redacts sensitive assignments", () => {
    expect(sanitizeErrorMessage('authorization: "token-value"')).toContain("[REDACTED]");
  });

  it("returns a generic fallback for empty input", () => {
    expect(sanitizeErrorMessage("   ")).toBe("The monitor check failed.");
  });

  it("redacts sensitive response headers", () => {
    const redacted = redactHeaders({ authorization: "Bearer secret", "content-type": "text/plain" });
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted["content-type"]).toBe("text/plain");
  });
});
