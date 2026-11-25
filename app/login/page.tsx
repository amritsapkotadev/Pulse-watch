import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getAdminSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Admin sign in",
  description: "Sign in to the private PulseWatch monitoring workspace.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getAdminSession();
  const nextPath = safeNextPath((await searchParams).next);
  if (session) redirect(nextPath);

  return <LoginForm nextPath={nextPath} />;
}
