import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { authorizeAdmin } from "@/lib/auth/guard";
import { deleteMonitor, getAdminMonitor, updateMonitor } from "@/lib/data/admin";
import { isDatabaseConfigured } from "@/lib/db";
import { idParamSchema, monitorWriteSchema } from "@/lib/monitoring/schemas";
import { isUnsafeTargetError } from "@/lib/monitoring/ssrf";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await authorizeAdmin(request, false);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  if (!params.success) return apiError("invalid_id", "Invalid monitor id.", 400);
  try {
    const monitor = await getAdminMonitor(params.data.id);
    if (!monitor) return apiError("not_found", "Monitor not found.", 404);
    return apiSuccess({ monitor }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  if (!params.success) return apiError("invalid_id", "Invalid monitor id.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Invalid JSON body.", 400);
  }
  const parsed = monitorWriteSchema.safeParse(body);
  if (!parsed.success) return apiError("invalid_body", "Monitor details are invalid.", 400);

  try {
    const monitor = await updateMonitor(params.data.id, parsed.data);
    return apiSuccess({ monitor }, { headers: noStoreHeaders() });
  } catch (error) {
    if (isUnsafeTargetError(error)) {
      return apiError("unsafe_target", "Target URL is not allowed.", 400);
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("not_found", "Monitor not found.", 404);
    }
    return serverError();
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  const params = idParamSchema.safeParse(await context.params);
  if (!params.success) return apiError("invalid_id", "Invalid monitor id.", 400);
  try {
    await deleteMonitor(params.data.id);
    return apiSuccess({ deleted: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("not_found", "Monitor not found.", 404);
    }
    return serverError();
  }
}
