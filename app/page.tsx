import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicDashboard } from "@/components/dashboard/public-dashboard";
import { PublicDataNotice } from "@/components/shared/public-data-notice";
import { PublicHeader } from "@/components/shared/public-header";
import { getPublicDashboardData } from "@/lib/data/dashboard";
import { isDatabaseConfigured } from "@/lib/db";
import { DEFAULT_ANALYTICS_RANGE } from "@/lib/monitoring/types";

export const metadata: Metadata = {
  title: "Service health and performance",
  description: "Public, real-time monitoring overview for PulseWatch services.",
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();

  if (!isDatabaseConfigured()) {
    return (
      <PublicDataNotice description="Set DATABASE_URL and DIRECT_URL, then apply migrations to load public monitoring data." />
    );
  }

  let data;
  try {
    data = await getPublicDashboardData(DEFAULT_ANALYTICS_RANGE);
  } catch {
    return (
      <PublicDataNotice description="Stored monitoring data could not be loaded. Check the database connection and try again." />
    );
  }
  return <PublicDashboard initialData={data} />;
}

function HomeFallback() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="rounded-xl border border-border bg-white px-6 py-12 text-center text-sm text-muted-foreground">
          Loading stored monitoring data…
        </div>
      </main>
    </div>
  );
}
