import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicDataNotice } from "@/components/shared/public-data-notice";
import { StatusPage } from "@/components/status/status-page";
import { getStatusSnapshot } from "@/lib/data/status";
import { isDatabaseConfigured } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Service Status | PulseWatch",
  description: "Live availability and incident status for PulseWatch public monitors.",
};

export default async function StatusRoute() {
  await connection();

  if (!isDatabaseConfigured()) {
    return (
      <PublicDataNotice description="Set DATABASE_URL and DIRECT_URL, then apply migrations to load stored status data." />
    );
  }

  let snapshot;
  try {
    snapshot = await getStatusSnapshot("24h");
  } catch {
    return (
      <PublicDataNotice description="Stored status data could not be loaded. Check the database connection and try again." />
    );
  }
  return <StatusPage initialSnapshot={snapshot} />;
}
