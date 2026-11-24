import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { formatLabel, StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { formatRelativeTime } from "@/lib/monitoring/format";
import type { PublicMonitorDto } from "@/lib/monitoring/types";

const statusTone: Record<PublicMonitorDto["currentStatus"], StatusTone> = {
  UP: "success",
  DOWN: "danger",
  UNKNOWN: "neutral",
};

const columns: DataTableColumn<PublicMonitorDto>[] = [
  {
    id: "name",
    header: "Monitor",
    cell: (row) => (
      <div className="space-y-0.5">
        <span className="font-medium text-foreground">{row.name}</span>
        <span className="block max-w-[260px] truncate text-xs text-muted-foreground">
          {row.description || "No description"}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={statusTone[row.currentStatus]}>
        {formatLabel(row.currentStatus)}
      </StatusBadge>
    ),
  },
  {
    id: "uptime",
    header: "Uptime",
    cell: (row) => (
      <span className="text-sm tabular-nums text-foreground">
        {row.uptimePercentage.toFixed(1)}%
      </span>
    ),
  },
  {
    id: "response",
    header: "Response Time",
    cell: (row) => (
      <span className="text-sm tabular-nums text-foreground">
        {row.lastResponseTime === null ? "—" : `${row.lastResponseTime} ms`}
      </span>
    ),
  },
  {
    id: "checked",
    header: "Last Checked",
    cell: (row) => (
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(row.lastCheckedAt)}
      </span>
    ),
  },
];

interface RecentMonitorsTableProps {
  monitors: PublicMonitorDto[];
}

export function RecentMonitorsTable({ monitors }: RecentMonitorsTableProps) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-3 px-5 pt-5 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Recent Monitors</CardTitle>
          <CardDescription>Live status from the shared monitor database</CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          <Button
            variant="link"
            size="sm"
            render={<Link href="/monitors" />}
            nativeButton={false}
            className="px-0"
          >
            Manage Monitors
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <DataTable
          columns={columns}
          rows={monitors}
          caption={monitors.length === 0 ? "No monitors have been configured yet." : "Live monitor status"}
          emptyMessage="No monitors have been configured yet."
        />
      </CardContent>
    </Card>
  );
}
