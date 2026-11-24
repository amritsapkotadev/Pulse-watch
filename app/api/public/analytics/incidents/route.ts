import { connection } from "next/server";

import {
  analyticsCacheHeaders,
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
} from "@/lib/api/response";
import { getAnalyticsIncidents } from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsIncidentsQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = analyticsIncidentsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return apiError("invalid_query", "Invalid incident analytics parameters.", 400, {
      headers: analyticsCacheHeaders(),
    });
  }
  try {
    const data = await getAnalyticsIncidents(
      query.data.range,
      query.data.page,
      query.data.pageSize,
    );
    return apiSuccess(data, { headers: analyticsCacheHeaders() });
  } catch {
    return serverError();
  }
}
