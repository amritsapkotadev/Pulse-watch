import { connection } from "next/server";

import {
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
  statusCacheHeaders,
} from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getStatusSnapshot } from "@/lib/data/status";
import { statusRangeQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = statusRangeQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return apiError("invalid_query", "Invalid status range.", 400, {
      headers: statusCacheHeaders(),
    });
  }
  try {
    const data = await getStatusSnapshot(query.data.range);
    return apiSuccess(data, { headers: statusCacheHeaders() });
  } catch {
    return serverError();
  }
}
