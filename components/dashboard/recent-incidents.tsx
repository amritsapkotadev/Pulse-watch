import Link from "next/link";
import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatLabel,
  incidentStatusTone,
  severityTone,
  StatusBadge,
} from "@/components/shared/status-badge";
import { recentIncidents, type IncidentRecord } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function IncidentIcon({ status }: { status: IncidentRecord["status"] }) {
  if (status === "resolved") {
    return <CircleCheck className="size-4 text-success" aria-hidden="true" />;
  }
  if (status === "investigating" || status === "identified") {
    return <CircleX className="size-4 text-danger" aria-hidden="true" />;
  }
  return (
    <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
  );
}

export function RecentIncidents() {
  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-3 px-5 pt-5 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Recent Incidents</CardTitle>
          <CardDescription>Ongoing and resolved demo incidents</CardDescription>
        </div>
        <CardAction>
          <Button
            variant="link"
            size="sm"
            render={<Link href="/incidents" />}
            nativeButton={false}
            className="px-0"
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2.5 px-5 pb-5">
        {recentIncidents.map((incident) => (
          <div
            key={incident.id}
            className={cn(
              "rounded-lg border px-3 py-3 transition-colors hover:bg-muted/30",
              incident.status === "resolved" ? "bg-muted/20" : "bg-card",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">
                <IncidentIcon status={incident.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {incident.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {incident.endpoint}
                </p>
              </div>
              <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                {incident.time}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-6.5">
              <StatusBadge tone={severityTone[incident.severity]} dot={false}>
                {formatLabel(incident.severity)} severity
              </StatusBadge>
              <StatusBadge tone={incidentStatusTone[incident.status]}>
                {formatLabel(incident.status)}
              </StatusBadge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
