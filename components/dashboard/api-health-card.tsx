import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MockDataNote } from "@/components/shared/mock-data-note";
import { StatusBadge } from "@/components/shared/status-badge";
import { dashboardStats } from "@/lib/mock-data";

export function ApiHealthCard() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">API Health Overview</CardTitle>
          <CardDescription>
            Uptime across all monitored endpoints · mock data
          </CardDescription>
        </div>
        <MockDataNote />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {dashboardStats.uptimePercentage.toFixed(2)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Overall uptime · last 30 days
            </p>
          </div>
          <StatusBadge tone="success">Mostly operational</StatusBadge>
        </div>

        <Progress
          aria-label="Overall API uptime"
          value={dashboardStats.uptimePercentage}
          className="mt-5 flex-col gap-2"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {dashboardStats.operational}/{dashboardStats.totalMonitors}{" "}
            operational
          </span>
          <span>
            {dashboardStats.down} down · {dashboardStats.degraded} degraded
          </span>
        </div>

        <p className="mt-5 rounded-lg border bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Most endpoints are healthy in this demo dataset. Payment API is down
          and NEPSE Data API is degraded; no live checks have been performed.
        </p>
      </CardContent>
    </Card>
  );
}
