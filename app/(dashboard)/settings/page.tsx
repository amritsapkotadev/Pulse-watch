import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/db";
import { getCronSecret, getAuthSecret } from "@/lib/monitoring/config";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/settings");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default async function SettingsPage() {
  const session = await requireAdminPage();
  const flags = [
    { label: "Database", value: isDatabaseConfigured() ? "Configured" : "Not configured" },
    { label: "Admin authentication", value: getAuthSecret() ? "Configured" : "Not configured" },
    { label: "Monitoring cron", value: getCronSecret() ? "Configured" : "Not configured" },
    {
      label: "Request execution",
      value: process.env.NODE_ENV === "production" ? "Disabled in production" : "Development only",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={item.title} description={item.description} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Administrator</CardTitle>
            <CardDescription>Signed-in account for this PulseWatch instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-0.5 truncate text-sm font-medium">{session.email}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Public pages are read-only and do not expose monitor URLs, headers, or credentials.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Public links</CardTitle>
            <CardDescription>Read-only surfaces available without administrator access.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 px-5 pb-5">
            <Button render={<Link href="/" />} nativeButton={false} variant="outline">
              Overview
            </Button>
            <Button render={<Link href="/status" />} nativeButton={false} variant="outline">
              Status page
            </Button>
            <Button render={<Link href="/api/public/status" />} nativeButton={false} variant="outline">
              Status API
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Environment status only. Secret values are never displayed.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              {flags.map((flag) => (
                <div className="rounded-lg border border-border px-3 py-2" key={flag.label}>
                  <dt className="text-xs text-muted-foreground">{flag.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{flag.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
