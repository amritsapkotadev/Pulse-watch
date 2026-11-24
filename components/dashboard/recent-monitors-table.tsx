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
import { MockDataNote } from "@/components/shared/mock-data-note";
import {
  formatLabel,
  monitorStatusTone,
  StatusBadge,
} from "@/components/shared/status-badge";
import { recentMonitors, type MonitorRecord } from "@/lib/mock-data";

const columns: DataTableColumn<MonitorRecord>[] = [
  {
    id: "name",
    header: "Monitor Name",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[0.65rem] font-semibold text-primary">
          {row.method}
        </span>
        <span className="font-medium text-foreground">{row.name}</span>
      </div>
    ),
  },
  {
    id: "endpoint",
    header: "Endpoint",
    cell: (row) => (
      <span
        className="block max-w-[260px] truncate font-mono text-xs text-muted-foreground"
        title={row.endpoint}
      >
        {row.endpoint}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={monitorStatusTone[row.status]}>
        {formatLabel(row.status)}
      </StatusBadge>
    ),
  },
  {
    id: "response",
    header: "Response Time",
    cell: (row) => (
      <span className="text-sm tabular-nums text-foreground">
        {row.status === "down" ? "—" : `${row.responseTimeMs} ms`}
      </span>
    ),
  },
  {
    id: "checked",
    header: "Last Checked",
    cell: (row) => (
      <span className="text-xs text-muted-foreground">{row.lastChecked}</span>
    ),
  },
];

export function RecentMonitorsTable() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-3 px-5 pt-5 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Recent Monitors</CardTitle>
          <CardDescription>
            Sample endpoints and their demo health status
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          <MockDataNote className="hidden sm:inline-flex" />
          <Button
            variant="link"
            size="sm"
            render={<Link href="/monitors" />}
            nativeButton={false}
            className="px-0"
          >
            View All Monitors
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <DataTable
          columns={columns}
          rows={recentMonitors}
          caption="Recent monitors with mock data"
        />
      </CardContent>
    </Card>
  );
}
