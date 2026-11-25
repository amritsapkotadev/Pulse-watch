import { NextResponse } from "next/server";

import { authorizeAdmin } from "@/lib/auth/guard";
import {
  executeRequestSchema,
  type ExecutionErrorCode,
  type ExecutionResponse,
} from "@/lib/requests/schema";
import {
  executeHttpRequest,
  getClientKey,
  getErrorStatus,
  toExecutionError,
} from "@/lib/server/request-executor";

const MAX_PAYLOAD_BYTES = 262_144;

function errorResponse(code: ExecutionErrorCode, message: string, status: number) {
  const body: ExecutionResponse = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;

  if (process.env.NODE_ENV === "production") {
    return errorResponse(
      "disabled",
      "Request execution is disabled in production. Configure a dedicated, authenticated proxy before enabling it.",
      403,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return errorResponse("invalid_request", "Request payload is too large.", 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return errorResponse("invalid_request", "Request payload is too large.", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid_request", "Request payload must be valid JSON.", 400);
  }

  const parsed = executeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "Invalid request payload.",
      400,
    );
  }

  try {
    const data = await executeHttpRequest(parsed.data, getClientKey(request.headers));
    const body: ExecutionResponse = { ok: true, data };
    return NextResponse.json(body);
  } catch (error) {
    const executionError = toExecutionError(error);
    return errorResponse(
      executionError.code,
      executionError.message,
      getErrorStatus(executionError.code),
    );
  }
}
