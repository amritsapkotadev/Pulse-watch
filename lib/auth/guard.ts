import { NextResponse } from "next/server";
import "server-only";

import { apiError } from "@/lib/api/response";
import { assertSameOrigin, getAdminSession, isValidCsrfToken, type AdminSession } from "@/lib/auth/session";

export async function authorizeAdmin(
  request: Request,
  requireCsrf = true,
): Promise<AdminSession | NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return apiError("unauthorized", "Administrator authentication is required.", 401);
  }
  if (requireCsrf) {
    if (!assertSameOrigin(request) || !isValidCsrfToken(session, request.headers.get("x-csrf-token"))) {
      return apiError("csrf_failed", "Invalid request origin or CSRF token.", 403);
    }
  }
  return session;
}

export function assertPublicMutationOrigin(request: Request): NextResponse | null {
  if (!assertSameOrigin(request)) {
    return apiError("csrf_failed", "Invalid request origin.", 403);
  }
  return null;
}
