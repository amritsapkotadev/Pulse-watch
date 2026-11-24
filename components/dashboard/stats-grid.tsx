import { Activity, CircleCheck, CircleX, Gauge } from "lucide-react";

import { StatisticsCard } from "@/components/shared/statistics-card";
import { dashboardStats } from "@/lib/mock-data";

export function StatsGrid() {
  return (
    <section
      aria-label="Workspace statistics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatisticsCard
        label="Total Monitors"
        value={String(dashboardStats.totalMonitors)}
        description="Across 3 demo environments"
        icon={Activity}
        tone="primary"
        change={{ value: "+3", label: "this month", direction: "up" }}
      />
      <StatisticsCard
        label="Operational"
        value={String(dashboardStats.operational)}
        description="87.5% of all monitors"
        icon={CircleCheck}
        tone="success"
        change={{ value: "+2", label: "vs last week", direction: "up" }}
      />
      <StatisticsCard
        label="Down"
        value={String(dashboardStats.down)}
        description="Endpoints need attention"
        icon={CircleX}
        tone="danger"
        change={{ value: "-1", label: "since yesterday", direction: "down" }}
      />
      <StatisticsCard
        label="Average Response Time"
        value={`${dashboardStats.averageResponseTimeMs} ms`}
        description="Across all monitored endpoints"
        icon={Gauge}
        tone="warning"
      />
    </section>
  );
}
