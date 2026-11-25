import { connection } from "next/server";

import {
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
  statusCacheHeaders,
} from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getPublicMonitors } from "@/lib/data/public";
import { paginationQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = paginationQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return apiError("invalid_query", "Invalid pagination parameters.", 400, {
      headers: statusCacheHeaders(),
    });
  }
  try {
    const { page, pageSize } = query.data;
    const { monitors, total } = await getPublicMonitors(page, pageSize);
    return apiSuccess({ monitors, total, page, pageSize }, { headers: statusCacheHeaders() });
  } catch {
    return serverError();
  }
}
