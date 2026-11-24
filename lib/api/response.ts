import { NextResponse } from "next/server";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(
  code: string,
  message: string,
  status: number,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message } } satisfies ApiErrorBody,
    { ...init, status },
  );
}

export function serverError(): NextResponse {
  return apiError("server_error", "The server could not complete this request.", 500, {
    headers: noStoreHeaders(),
  });
}

export function databaseUnavailable(): NextResponse {
  return apiError(
    "database_unavailable",
    "The database is not configured. Set DATABASE_URL and DIRECT_URL, then generate the Prisma client and apply migrations.",
    503,
    { headers: noStoreHeaders() },
  );
}

export function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };
}
