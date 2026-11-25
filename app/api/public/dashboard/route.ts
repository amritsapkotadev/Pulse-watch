import { connection } from "next/server";

import {
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
  statusCacheHeaders,
} from "@/lib/api/response";
import { getPublicDashboardData } from "@/lib/data/dashboard";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsRangeQuerySchema } from "@/lib/monitoring/schemas";
import { DEFAULT_ANALYTICS_RANGE } from "@/lib/monitoring/types";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = params.range ? analyticsRangeQuerySchema.safeParse(params) : null;
  if (query && !query.success) {
    return apiError("invalid_query", "Invalid dashboard range.", 400, {
      headers: statusCacheHeaders(),
    });
  }
  const range = query?.success ? query.data.range : DEFAULT_ANALYTICS_RANGE;
  try {
    const data = await getPublicDashboardData(range);
    return apiSuccess(data, { headers: statusCacheHeaders() });
  } catch {
    return serverError();
  }
}
