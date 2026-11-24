import { connection } from "next/server";

import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import { getPublicMonitorHistory } from "@/lib/data/public";
import { historyQuerySchema, idParamSchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  const query = historyQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success || !query.success) {
    return apiError("invalid_query", "Invalid monitor history parameters.", 400, {
      headers: noStoreHeaders(),
    });
  }
  try {
    const history = await getPublicMonitorHistory(params.data.id, query.data.range);
    if (!history) {
      return apiError("not_found", "Monitor not found.", 404, { headers: noStoreHeaders() });
    }
    return apiSuccess(history, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}
