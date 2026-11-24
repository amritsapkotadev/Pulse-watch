import { connection } from "next/server";

import {
  analyticsCacheHeaders,
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
} from "@/lib/api/response";
import { getAnalyticsMonitors } from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsMonitorsQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = analyticsMonitorsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return apiError("invalid_query", "Invalid monitor analytics parameters.", 400, {
      headers: analyticsCacheHeaders(),
    });
  }
  try {
    const data = await getAnalyticsMonitors(
      query.data.range,
      query.data.page,
      query.data.pageSize,
      query.data.sort,
      query.data.order,
      query.data.search,
    );
    return apiSuccess(data, { headers: analyticsCacheHeaders() });
  } catch {
    return serverError();
  }
}
