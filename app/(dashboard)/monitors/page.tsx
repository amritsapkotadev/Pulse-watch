import type { Metadata } from "next";
import { connection } from "next/server";

import {
  MonitorManager,
  type AdminMonitor,
} from "@/components/monitors/monitor-manager";
import { requireAdminPage } from "@/lib/auth/dal";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/monitors");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default async function MonitorsPage() {
  await connection();
  const session = await requireAdminPage();

  let initialMonitors: AdminMonitor[] = [];
  if (isDatabaseConfigured()) {
    try {
      const monitors = await prisma.monitor.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          url: true,
          method: true,
          expectedStatus: true,
          intervalMinutes: true,
          timeoutSeconds: true,
          isActive: true,
          displayPublicly: true,
          currentStatus: true,
          lastCheckedAt: true,
          consecutiveFailures: true,
          _count: { select: { checks: true, incidents: true } },
        },
      });
      initialMonitors = monitors.map((monitor) => ({
        ...monitor,
        method: String(monitor.method),
        currentStatus: String(monitor.currentStatus),
        lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
      }));
    } catch {
      initialMonitors = [];
    }
  }

  return <MonitorManager csrfToken={session.csrfToken} initialMonitors={initialMonitors} />;
}
