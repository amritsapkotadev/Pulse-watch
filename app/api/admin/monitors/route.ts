import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { authorizeAdmin } from "@/lib/auth/guard";
import { createMonitor, listAdminMonitors } from "@/lib/data/admin";
import { isDatabaseConfigured } from "@/lib/db";
import { monitorWriteSchema } from "@/lib/monitoring/schemas";
import { isUnsafeTargetError } from "@/lib/monitoring/ssrf";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, false);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  try {
    const monitors = await listAdminMonitors();
    return apiSuccess({ monitors }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Invalid JSON body.", 400, { headers: noStoreHeaders() });
  }
  const parsed = monitorWriteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_body", "Monitor details are invalid.", 400, { headers: noStoreHeaders() });
  }

  try {
    const monitor = await createMonitor(parsed.data);
    return apiSuccess({ monitor }, { headers: noStoreHeaders() });
  } catch (error) {
    if (isUnsafeTargetError(error)) {
      return apiError("unsafe_target", "Target URL is not allowed.", 400, { headers: noStoreHeaders() });
    }
    return serverError();
  }
}
