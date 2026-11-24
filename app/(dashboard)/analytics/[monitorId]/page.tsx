import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";

import { AnalyticsDataNotice } from "@/components/analytics/analytics-data-notice";
import { MonitorAnalyticsDetail } from "@/components/analytics/monitor-analytics-detail";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicMonitorAnalytics } from "@/lib/data/analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { analyticsRangeQuerySchema, idParamSchema } from "@/lib/monitoring/schemas";
import { DEFAULT_ANALYTICS_RANGE, type MonitorAnalyticsDto } from "@/lib/monitoring/types";

export const metadata: Metadata = {
  title: "Monitor analytics",
  description: "Historical analytics for an individual public API monitor.",
};

export const instant = false;

interface MonitorAnalyticsPageProps {
  params: Promise<{ monitorId: string }>;
  searchParams: Promise<{ range?: string }>;
}

async function MonitorAnalyticsContent({ params, searchParams }: MonitorAnalyticsPageProps) {
  await connection();
  const id = idParamSchema.safeParse(await params);
  const parsedRange = analyticsRangeQuerySchema.safeParse(await searchParams);
  if (!id.success) notFound();
  const range = parsedRange.success ? parsedRange.data.range : DEFAULT_ANALYTICS_RANGE;

  if (!isDatabaseConfigured()) {
    return (
      <AnalyticsDataNotice
        title="Database is not configured"
        description="Set DATABASE_URL and DIRECT_URL to load stored monitoring analytics."
      />
    );
  }

  let data: MonitorAnalyticsDto | null = null;
  let failed = false;
  try {
    data = await getPublicMonitorAnalytics(id.data.id, range);
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
  if (!data) notFound();
  return <MonitorAnalyticsDetail data={data} />;
}

export default function MonitorAnalyticsPage(props: MonitorAnalyticsPageProps) {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading stored monitor analytics…
          </CardContent>
        </Card>
      }
    >
      <MonitorAnalyticsContent {...props} />
    </Suspense>
  );
}
