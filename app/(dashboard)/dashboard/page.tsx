import { Suspense } from "react";

import type { Metadata } from "next";
import { connection } from "next/server";
import { Database } from "lucide-react";

import { ApiHealthCard } from "@/components/dashboard/api-health-card";
import { OverviewWelcome } from "@/components/dashboard/overview-welcome";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentIncidents } from "@/components/dashboard/recent-incidents";
import { RecentMonitorsTable } from "@/components/dashboard/recent-monitors-table";
import { ResponseTimeChart } from "@/components/dashboard/response-time-chart";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublicIncidents,
  getPublicMonitors,
  getPublicOverview,
  getPublicResponseSeries,
} from "@/lib/data/public";
import { isDatabaseConfigured } from "@/lib/db";
import type { DashboardData } from "@/lib/monitoring/types";

export const metadata: Metadata = {
  title: "Overview",
  description: "Live PulseWatch monitoring data sourced from the shared database.",
};

function DataNotice({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Database className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-muted-foreground">
        Set <code className="rounded bg-muted px-1 py-0.5">DATABASE_URL</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">DIRECT_URL</code>, and{" "}
        <code className="rounded bg-muted px-1 py-0.5">AUTH_SECRET</code>, run the Prisma migration,
        then add a monitor in the admin panel. PulseWatch will never substitute mock monitoring
        results.
      </CardContent>
    </Card>
  );
}

async function DashboardContent() {
  await connection();

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-7">
        <OverviewWelcome generatedAt={new Date().toISOString()} hasData={false} />
        <DataNotice
          title="Database is not configured"
          description="Live monitoring data is unavailable until Neon credentials are added."
        />
      </div>
    );
  }

  let data: DashboardData;
  try {
    const [overview, monitors, incidents, history] = await Promise.all([
      getPublicOverview(),
      getPublicMonitors(1, 25),
      getPublicIncidents(1, 5),
      getPublicResponseSeries("24h"),
    ]);
    data = {
      generatedAt: new Date().toISOString(),
      stats: {
        totalMonitors: overview.totalMonitors,
        operationalMonitors: overview.operationalMonitors,
        downMonitors: overview.downMonitors,
        unknownMonitors: overview.unknownMonitors,
        averageResponseTimeMs: overview.averageResponseTimeMs,
        uptimePercentage: overview.uptimePercentage,
      },
      monitors: monitors.monitors,
      incidents: incidents.incidents,
      history,
      hasData: overview.totalMonitors > 0,
    };
  } catch {
    return (
      <div className="space-y-7">
        <OverviewWelcome generatedAt={new Date().toISOString()} hasData={false} />
        <DataNotice
          title="Live data could not be loaded"
          description="Check the database connection and migration state, then refresh."
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <OverviewWelcome generatedAt={data.generatedAt} hasData={data.hasData} />
      <StatsGrid stats={data.stats} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ResponseTimeChart
            data={data.history}
            averageResponseTimeMs={data.stats.averageResponseTimeMs}
          />
        </div>
        <ApiHealthCard stats={data.stats} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentMonitorsTable monitors={data.monitors} />
        <RecentIncidents incidents={data.incidents} />
      </div>

      <QuickActions />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading live monitoring data…
          </CardContent>
        </Card>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
