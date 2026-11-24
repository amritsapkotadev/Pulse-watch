import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { StatusPage } from "@/components/status/status-page";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusSnapshot } from "@/lib/data/status";
import { isDatabaseConfigured } from "@/lib/db";
import type { Metadata } from "next";

export const instant = false;

export const metadata: Metadata = {
  title: "Service Status | PulseWatch",
  description: "Live availability and incident status for PulseWatch public monitors.",
};

export default async function StatusRoute() {
  await connection();

  if (!isDatabaseConfigured()) {
    return <StatusNotice title="Status data is unavailable" message="Database configuration is missing. Configure DATABASE_URL and DIRECT_URL, then retry." />;
  }

  let snapshot;
  try {
    snapshot = await getStatusSnapshot("24h");
  } catch {
    return <StatusNotice title="Status data is unavailable" message="Stored status data could not be loaded. Monitoring checks may not have run yet." />;
  }

  return <StatusPage initialSnapshot={snapshot} />;
}

function StatusNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 text-slate-900">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-sm">
        <CardContent className="px-6 py-10 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{message}</p>
          <Link
            className="mt-5 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-800"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
