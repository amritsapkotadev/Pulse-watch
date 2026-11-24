import { connection } from "next/server";

import {
  analyticsCacheHeaders,
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
} from "@/lib/api/response";
import { getPublicMonitorAnalytics } from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsRangeQuerySchema, idParamSchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  const query = analyticsRangeQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!params.success || !query.success) {
    return apiError("invalid_query", "Invalid monitor analytics parameters.", 400, {
      headers: analyticsCacheHeaders(),
    });
  }
  try {
    const data = await getPublicMonitorAnalytics(params.data.id, query.data.range);
    if (!data) {
      return apiError("not_found", "Monitor not found.", 404, {
        headers: analyticsCacheHeaders(),
      });
    }
    return apiSuccess(data, { headers: analyticsCacheHeaders() });
  } catch {
    return serverError();
  }
}
