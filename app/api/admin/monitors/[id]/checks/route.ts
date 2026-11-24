import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { authorizeAdmin } from "@/lib/auth/guard";
import { getAdminChecks, getAdminMonitor } from "@/lib/data/admin";
import { isDatabaseConfigured } from "@/lib/db";
import { idParamSchema, paginationQuerySchema } from "@/lib/monitoring/schemas";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, false);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  const query = paginationQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success || !query.success) {
    return apiError("invalid_query", "Invalid check query.", 400);
  }
  try {
    const monitor = await getAdminMonitor(params.data.id);
    if (!monitor) return apiError("not_found", "Monitor not found.", 404);
    const { page, pageSize } = query.data;
    const { checks, total } = await getAdminChecks(params.data.id, page, pageSize);
    return apiSuccess({ checks, total, page, pageSize }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}
