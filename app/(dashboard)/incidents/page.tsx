import { Suspense } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatLabel,
  StatusBadge,
  type StatusTone,
} from "@/components/shared/status-badge";
import { getPublicIncidents } from "@/lib/data/public";
import { isDatabaseConfigured } from "@/lib/db";
import { formatDateTime } from "@/lib/monitoring/format";
import { getNavItem } from "@/lib/navigation";
import type { PublicIncidentDto } from "@/lib/monitoring/types";

const item = getNavItem("/incidents");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

const severityTone: Record<PublicIncidentDto["severity"], StatusTone> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "danger",
};

const statusTone: Record<PublicIncidentDto["status"], StatusTone> = {
  ACTIVE: "danger",
  RESOLVED: "success",
};

async function IncidentsContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();

  if (!isDatabaseConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>Configure the database to load live incidents.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const requestedPage = Number((await searchParams).page ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const pageSize = 25;

  let incidents: PublicIncidentDto[] = [];
  let total = 0;
  try {
    const result = await getPublicIncidents(page, pageSize);
    incidents = result.incidents;
    total = result.total;
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>Live incidents could not be loaded.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Failures detected after the configured threshold and their resolutions.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-2 px-5 pb-5 pt-5">
          {incidents.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No incidents recorded yet.
            </p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{incident.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {incident.monitorName} · {incident.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatDateTime(incident.startedAt)} UTC
                      {incident.resolvedAt
                        ? ` · Resolved ${formatDateTime(incident.resolvedAt)} UTC`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={severityTone[incident.severity]} dot={false}>
                      {formatLabel(incident.severity)}
                    </StatusBadge>
                    <StatusBadge tone={statusTone[incident.status]}>
                      {formatLabel(incident.status)}
                    </StatusBadge>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages} · {total} incidents
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            render={<Link href={`/incidents?page=${page - 1}`} />}
            nativeButton={false}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            render={<Link href={`/incidents?page=${page + 1}`} />}
            nativeButton={false}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading incidents…
          </CardContent>
        </Card>
      }
    >
      <IncidentsContent searchParams={searchParams} />
    </Suspense>
  );
}
