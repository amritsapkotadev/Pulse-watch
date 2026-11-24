import { apiError, apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { authorizeAdmin } from "@/lib/auth/guard";
import { getStoredWorkspace, importWorkspace } from "@/lib/data/admin";
import { isDatabaseConfigured } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, false);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();
  try {
    const workspace = await getStoredWorkspace();
    return apiSuccess({ workspace }, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isDatabaseConfigured()) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Invalid JSON body.", 400);
  }

  try {
    const imported = await importWorkspace(body);
    return apiSuccess({ imported }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid")) {
      return apiError("invalid_workspace", error.message, 400);
    }
    return serverError();
  }
}
