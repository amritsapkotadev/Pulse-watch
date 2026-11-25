import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth/session";
import type { AdminSession } from "@/lib/auth/token";

export const requireAdminPage = cache(async (): Promise<AdminSession> => {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
});
