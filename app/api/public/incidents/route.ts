import { connection } from "next/server";

import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getPublicIncidents } from "@/lib/data/public";
import { paginationQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const query = paginationQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return apiError("invalid_query", "Invalid pagination parameters.", 400, { headers: noStoreHeaders() });
  }
  try {
    const { page, pageSize } = query.data;
    const { incidents, total } = await getPublicIncidents(page, pageSize);
    return apiSuccess({ incidents, total, page, pageSize }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}
