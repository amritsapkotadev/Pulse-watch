import { z } from "zod";

import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { clearRateLimit, checkRateLimit } from "@/lib/auth/rate-limit";
import { applyAdminSessionCookies, createAdminSession, assertSameOrigin } from "@/lib/auth/session";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getAuthSecret } from "@/lib/monitoring/config";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return apiError("csrf_failed", "Invalid request origin.", 403, { headers: noStoreHeaders() });
  }
  if (!getAuthSecret()) {
    return apiError("auth_not_configured", "AUTH_SECRET is not configured.", 503, {
      headers: noStoreHeaders(),
    });
  }
  if (!isDatabaseConfigured()) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Invalid JSON body.", 400, { headers: noStoreHeaders() });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_body", "Enter a valid email and password.", 400, {
      headers: noStoreHeaders(),
    });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rateLimitKey = `${parsed.data.email}:${ip}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return apiError("rate_limited", "Too many login attempts. Try again later.", 429, {
      headers: { ...noStoreHeaders(), "Retry-After": String(rateLimit.retryAfter) },
    });
  }

  try {
    const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
    const valid = admin ? await verifyPassword(parsed.data.password, admin.passwordHash) : false;
    if (!admin || !valid) {
      return apiError("invalid_credentials", "Invalid email or password.", 401, {
        headers: noStoreHeaders(),
      });
    }

    clearRateLimit(rateLimitKey);
    const { token, csrfToken } = await createAdminSession(admin.id, admin.email);
    const response = apiSuccess(
      { email: admin.email, csrfToken },
      { headers: noStoreHeaders() },
    );
    applyAdminSessionCookies(response, token);
    return response;
  } catch {
    return serverError();
  }
}
