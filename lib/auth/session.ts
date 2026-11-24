import { timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import "server-only";

import { getAppUrl, getAuthSecret } from "@/lib/monitoring/config";

export const ADMIN_SESSION_COOKIE = "pulsewatch_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  adminId: string;
  email: string;
  csrfToken: string;
  expiresAt: number;
}

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

export async function verifyAdminSessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  if (!getAuthSecret()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.csrfToken !== "string") {
      return null;
    }
    return {
      adminId: payload.sub,
      email: payload.email,
      csrfToken: payload.csrfToken,
      expiresAt: (payload.exp ?? 0) * 1000,
    };
  } catch {
    return null;
  }
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
  if (!candidate) return true;

  try {
    const candidateUrl = new URL(candidate);
    const appUrl = new URL(getAppUrl());
    const host = request.headers.get("host");
    return (
      candidateUrl.host === appUrl.host ||
      (Boolean(host) && candidateUrl.host === host) ||
      candidateUrl.host === "localhost:3000"
    );
  } catch {
    return false;
  }
}
