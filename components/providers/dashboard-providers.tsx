"use client";

import type { ReactNode } from "react";

import { WorkspaceProvider } from "@/components/providers/workspace-provider";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
