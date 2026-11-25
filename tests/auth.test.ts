import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/auth/token";

const SECRET = "test-secret-with-at-least-thirty-two-characters";

async function makeToken(adminId = "admin-1") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: "admin@example.com", csrfToken: "csrf-token" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

describe("admin session tokens", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  it("verifies a valid session token", async () => {
    const session = await verifyAdminSessionToken(await makeToken());
    expect(session).toMatchObject({
      adminId: "admin-1",
      email: "admin@example.com",
      csrfToken: "csrf-token",
    });
  });

  it("rejects missing and invalid tokens", async () => {
    expect(await verifyAdminSessionToken(undefined)).toBeNull();
    expect(await verifyAdminSessionToken("not-a-token")).toBeNull();
  });

  it("allows only safe local next paths", () => {
    expect(safeNextPath("/dashboard?range=7d")).toBe("/dashboard?range=7d");
    expect(safeNextPath("https://example.com/phish")).toBe("/dashboard");
    expect(safeNextPath("//example.com")).toBe("/dashboard");
  });

  it("allows public routes without a session", async () => {
    const response = await proxy(new NextRequest("https://pulsewatch.test/status"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated private pages to login", async () => {
    const response = await proxy(new NextRequest("https://pulsewatch.test/monitors"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fmonitors");
  });

  it("returns JSON 401 for unauthenticated private APIs", async () => {
    const response = await proxy(new NextRequest("https://pulsewatch.test/api/admin/monitors"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("allows authenticated private requests", async () => {
    const request = new NextRequest("https://pulsewatch.test/dashboard", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await makeToken()}` },
    });
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });
});
