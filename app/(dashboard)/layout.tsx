import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardProviders } from "@/components/providers/dashboard-providers";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProviders>
      <AppShell>{children}</AppShell>
    </DashboardProviders>
  );
}
