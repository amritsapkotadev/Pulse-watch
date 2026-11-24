import { apiError, apiSuccess, noStoreHeaders, serverError } from "@/lib/api/response";
import { clearAdminSessionCookies, getAdminSession } from "@/lib/auth/session";
import { authorizeAdmin } from "@/lib/auth/guard";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return apiError("unauthorized", "Administrator authentication is required.", 401, {
        headers: noStoreHeaders(),
      });
    }
    return apiSuccess(
      { authenticated: true, email: session.email, csrfToken: session.csrfToken },
      { headers: noStoreHeaders() },
    );
  } catch {
    return serverError();
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth instanceof Response) return auth;
  const response = apiSuccess({ authenticated: false }, { headers: noStoreHeaders() });
  clearAdminSessionCookies(response);
  return response;
}
