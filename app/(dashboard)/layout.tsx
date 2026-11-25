import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardProviders } from "@/components/providers/dashboard-providers";
import { requireAdminPage } from "@/lib/auth/dal";

export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return (
    <DashboardProviders>
      <AppShell adminEmail={session.email} csrfToken={session.csrfToken}>
        {children}
      </AppShell>
    </DashboardProviders>
  );
}
