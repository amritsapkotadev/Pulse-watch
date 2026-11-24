import { Activity, CircleCheck, CircleX, Gauge } from "lucide-react";

import { StatisticsCard } from "@/components/shared/statistics-card";
import type { DashboardData } from "@/lib/monitoring/types";

interface StatsGridProps {
  stats: DashboardData["stats"];
}

export function StatsGrid({ stats }: StatsGridProps) {
  const operationalShare =
    stats.totalMonitors > 0
      ? Math.round((stats.operationalMonitors / stats.totalMonitors) * 100)
      : 0;

  return (
    <section
      aria-label="Workspace statistics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatisticsCard
        label="Total Monitors"
        value={String(stats.totalMonitors)}
        description="Public monitors configured in the database"
        icon={Activity}
        tone="primary"
      />
      <StatisticsCard
        label="Operational"
        value={String(stats.operationalMonitors)}
        description={`${operationalShare}% of all monitors`}
        icon={CircleCheck}
        tone="success"
      />
      <StatisticsCard
        label="Down"
        value={String(stats.downMonitors)}
        description="Monitors currently failing checks"
        icon={CircleX}
        tone="danger"
      />
      <StatisticsCard
        label="Average Response Time"
        value={`${stats.averageResponseTimeMs} ms`}
        description="Across checks in the last 24 hours"
        icon={Gauge}
        tone="warning"
      />
    </section>
  );
}
