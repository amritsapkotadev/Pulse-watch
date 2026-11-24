import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { authorizeAdmin } from "@/lib/auth/guard";
import { getAdminMonitor } from "@/lib/data/admin";
import { isDatabaseConfigured } from "@/lib/db";
import { acquireMonitorLease, executeMonitorCheck, releaseMonitorLease } from "@/lib/monitoring/engine";
import { idParamSchema } from "@/lib/monitoring/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  if (!params.success) return apiError("invalid_id", "Invalid monitor id.", 400);

  try {
    const monitor = await getAdminMonitor(params.data.id);
    if (!monitor) return apiError("not_found", "Monitor not found.", 404);
    const ownerId = `manual-${auth.adminId}-${Date.now()}`;
    const acquired = await acquireMonitorLease(monitor.id, ownerId);
    if (!acquired) {
      return apiError("check_in_progress", "A check is already in progress for this monitor.", 409);
    }
    try {
      await executeMonitorCheck(monitor.id);
    } finally {
      await releaseMonitorLease(monitor.id, ownerId);
    }
    const updated = await getAdminMonitor(monitor.id);
    return apiSuccess({ monitor: updated }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}
