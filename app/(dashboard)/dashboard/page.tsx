import type { Metadata } from "next";

import { ApiHealthCard } from "@/components/dashboard/api-health-card";
import { OverviewWelcome } from "@/components/dashboard/overview-welcome";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentIncidents } from "@/components/dashboard/recent-incidents";
import { RecentMonitorsTable } from "@/components/dashboard/recent-monitors-table";
import { ResponseTimeChart } from "@/components/dashboard/response-time-chart";
import { StatsGrid } from "@/components/dashboard/stats-grid";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "PulseWatch workspace overview with mock monitoring and API health data.",
};

export default function DashboardPage() {
  return (
    <div className="space-y-7">
      <OverviewWelcome />
      <StatsGrid />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ResponseTimeChart />
        </div>
        <ApiHealthCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentMonitorsTable />
        <RecentIncidents />
      </div>

      <QuickActions />
    </div>
  );
}
