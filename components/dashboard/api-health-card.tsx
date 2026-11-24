import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import type { DashboardData } from "@/lib/monitoring/types";

interface ApiHealthCardProps {
  stats: DashboardData["stats"];
}

export function ApiHealthCard({ stats }: ApiHealthCardProps) {
  const tone: StatusTone =
    stats.downMonitors > 0 ? "danger" : stats.operationalMonitors > 0 ? "success" : "neutral";
  const label =
    stats.downMonitors > 0
      ? "Attention needed"
      : stats.operationalMonitors > 0
        ? "Operational"
        : "No live data";

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">API Health Overview</CardTitle>
          <CardDescription>Uptime from real checks in the last 24 hours</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {stats.uptimePercentage.toFixed(2)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Overall uptime · last 24 hours
            </p>
          </div>
          <StatusBadge tone={tone}>{label}</StatusBadge>
        </div>

        <Progress
          aria-label="Overall API uptime"
          value={stats.uptimePercentage}
          className="mt-5 flex-col gap-2"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {stats.operationalMonitors}/{stats.totalMonitors} operational
          </span>
          <span>
            {stats.downMonitors} down · {stats.unknownMonitors} unknown
          </span>
        </div>

        <p className="mt-5 rounded-lg border bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {stats.totalMonitors === 0
            ? "No monitors are configured yet. Add one in the admin panel to start collecting real uptime data."
            : "Uptime is calculated only from stored check results. No mock data is used."}
        </p>
      </CardContent>
    </Card>
  );
}
