import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AnalyticsDataNotice } from "@/components/analytics/analytics-data-notice";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAnalyticsIncidents,
  getAnalyticsMonitors,
  getAnalyticsOverview,
  getAnalyticsResponseTime,
  getAnalyticsUptime,
} from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsRangeQuerySchema } from "@/lib/monitoring/schemas";
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsBundleDto } from "@/lib/monitoring/types";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/analytics");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

interface AnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

async function AnalyticsContent({ searchParams }: AnalyticsPageProps) {
  await connection();
  const parsed = analyticsRangeQuerySchema.safeParse(await searchParams);
  const range = parsed.success ? parsed.data.range : DEFAULT_ANALYTICS_RANGE;

  if (!isDatabaseConfigured()) {
    return (
      <AnalyticsDataNotice
        title="Database is not configured"
        description="Set DATABASE_URL and DIRECT_URL to load stored monitoring analytics."
      />
    );
  }

  let bundle: AnalyticsBundleDto | null = null;
  let failed = false;
  try {
    const [overview, uptime, incidents, responseTime, monitors] = await Promise.all([
      getAnalyticsOverview(range),
      getAnalyticsUptime(range),
      getAnalyticsIncidents(range, 1, 10),
      getAnalyticsResponseTime(range),
      getAnalyticsMonitors(range, 1, 100, "name", "asc", undefined),
    ]);
    bundle = { overview, uptime, responseTime, incidents, monitors };
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <AnalyticsDataNotice
        title="Analytics data could not be loaded"
        description="Check the database connection and migration state, then refresh."
      />
    );
  }
  if (!bundle) notFound();
  return <AnalyticsDashboard initialBundle={bundle} />;
}

export default function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading stored monitoring analytics…
          </CardContent>
        </Card>
      }
    >
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  );
}
