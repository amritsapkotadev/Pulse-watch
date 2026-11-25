import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/token";

const PUBLIC_PAGE_PATHS = new Set(["/", "/status", "/login"]);
const PUBLIC_API_PATHS = new Set(["/api/admin/login"]);
const PUBLIC_API_PREFIXES = ["/api/public/", "/api/cron/", "/api/internal/"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGE_PATHS.has(pathname) ||
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function hasValidOrigin(request: NextRequest): boolean {
  const candidate = request.headers.get("origin") ?? request.headers.get("referer");
  if (!candidate) return false;
  try {
    return new URL(candidate).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Administrator authentication is required." } },
        {
          status: 401,
          headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method) && !hasValidOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: { code: "csrf_failed", message: "Invalid request origin." } },
      { status: 403, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|css|js|map)$).*)",
  ],
};
