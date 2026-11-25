import { jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "pulsewatch_admin_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  adminId: string;
  email: string;
  csrfToken: string;
  expiresAt: number;
}

export function hasAuthSecret(): boolean {
  const secret = process.env.AUTH_SECRET;
  return Boolean(secret && secret.length >= 32);
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is not configured.");
  return new TextEncoder().encode(secret);
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token || !hasAuthSecret()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
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
