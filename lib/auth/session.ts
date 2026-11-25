import { timingSafeEqual } from "node:crypto";

import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import "server-only";

import { getAppUrl, getAuthSecret } from "@/lib/monitoring/config";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifyAdminSessionToken,
  type AdminSession,
} from "@/lib/auth/token";

export { ADMIN_SESSION_COOKIE, type AdminSession } from "@/lib/auth/token";

function secretKey(): Uint8Array {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return new TextEncoder().encode(secret);
}

export async function createAdminSession(
  adminId: string,
  email: string,
): Promise<{ token: string; csrfToken: string }> {
  const csrfToken = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email, csrfToken })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey());
  return { token, csrfToken };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}

export function applyAdminSessionCookies(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookies(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function isValidCsrfToken(session: AdminSession, token: string | null): boolean {
  return Boolean(token && safeEqual(session.csrfToken, token));
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin ?? referer;
  if (!candidate) return false;

  try {
    const candidateUrl = new URL(candidate);
    const requestUrl = new URL(request.url);
    const appUrl = new URL(getAppUrl());
    return candidateUrl.origin === requestUrl.origin || candidateUrl.host === appUrl.host;
  } catch {
    return false;
  }
}
