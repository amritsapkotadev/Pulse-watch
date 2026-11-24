import { connection } from "next/server";

import {
  analyticsCacheHeaders,
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
} from "@/lib/api/response";
import { getAnalyticsOverview } from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsRangeQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = analyticsRangeQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return apiError("invalid_query", "Invalid analytics range.", 400, {
      headers: analyticsCacheHeaders(),
    });
  }
  try {
    const data = await getAnalyticsOverview(query.data.range);
    return apiSuccess(data, { headers: analyticsCacheHeaders() });
  } catch {
    return serverError();
  }
}
