import { connection } from "next/server";

import {
  apiError,
  apiSuccess,
  databaseUnavailable,
  serverError,
  statusCacheHeaders,
} from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getStatusIncidents } from "@/lib/data/status";
import { statusIncidentsQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = statusIncidentsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return apiError("invalid_query", "Invalid incident query.", 400, {
      headers: statusCacheHeaders(),
    });
  }
  try {
    const { range, page, pageSize } = query.data;
    const { incidents, total } = await getStatusIncidents(range, page, pageSize);
    return apiSuccess(
      { range, generatedAt: new Date().toISOString(), total, page, pageSize, incidents },
      { headers: statusCacheHeaders() },
    );
  } catch {
    return serverError();
  }
}
