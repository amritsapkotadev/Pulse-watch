import { timingSafeEqual } from "node:crypto";

import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getCronSecret } from "@/lib/monitoring/config";
import { runDueChecks } from "@/lib/monitoring/engine";

function isAuthorized(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization");
  const headerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const queryToken = new URL(request.url).searchParams.get("secret");
  const token = headerToken ?? queryToken;
  if (!token) return false;
  const expected = new TextEncoder().encode(secret);
  const actual = new TextEncoder().encode(token);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

async function handle(request: Request) {
  const secret = getCronSecret();
  if (!secret) {
    return apiError("cron_not_configured", "CRON_SECRET is not configured.", 503, {
      headers: noStoreHeaders(),
    });
  }
  if (!isAuthorized(request, secret)) {
    return apiError("unauthorized", "Invalid cron secret.", 401, { headers: noStoreHeaders() });
  }
  if (!isDatabaseConfigured()) return databaseUnavailable();
  try {
    const summary = await runDueChecks(`cron-${Date.now()}`);
    return apiSuccess(summary, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
