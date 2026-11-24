"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Server,
  Timer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnalyticsRangeSelector } from "@/components/analytics/analytics-range-selector";
import {
  MonitorComparisonChart,
  ResponseTimeTrendChart,
  UptimeTrendChart,
} from "@/components/analytics/analytics-charts";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { formatLabel, StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatisticsCard } from "@/components/shared/statistics-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatDuration } from "@/lib/monitoring/format";
import type {
  AnalyticsBundleDto,
  AnalyticsIncidentDto,
  AnalyticsMonitorSummaryDto,
  AnalyticsRange,
  AnalyticsSort,
} from "@/lib/monitoring/types";

interface AnalyticsDashboardProps {
  initialBundle: AnalyticsBundleDto;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error?.message ?? "Unable to load analytics.");
  }
  return payload.data;
}

function statusTone(status: AnalyticsMonitorSummaryDto["currentStatus"]): StatusTone {
  if (status === "UP") return "success";
  if (status === "DOWN") return "danger";
  return "neutral";
}

function severityTone(severity: AnalyticsIncidentDto["severity"]): StatusTone {
  if (severity === "CRITICAL") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function compareNullable(
  left: number | null,
  right: number | null,
  direction: number,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction * (left - right);
}

function compareMonitors(
  left: AnalyticsMonitorSummaryDto,
  right: AnalyticsMonitorSummaryDto,
  sort: AnalyticsSort,
  order: "asc" | "desc",
): number {
  const direction = order === "asc" ? 1 : -1;
  switch (sort) {
    case "uptimePercentage":
      return direction * (left.uptimePercentage - right.uptimePercentage);
    case "averageResponseTimeMs":
      return compareNullable(left.averageResponseTimeMs, right.averageResponseTimeMs, direction);
    case "totalChecks":
      return direction * (left.totalChecks - right.totalChecks);
    case "failedChecks":
      return direction * (left.failedChecks - right.failedChecks);
    case "name":
      return direction * left.name.localeCompare(right.name);
  }
}

export function AnalyticsDashboard({ initialBundle }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<AnalyticsRange>(initialBundle.overview.range);
  const [bundle, setBundle] = useState(initialBundle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AnalyticsSort>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = `range=${range}`;
    Promise.all([
      fetchJson<AnalyticsBundleDto["overview"]>(
        `/api/public/analytics/overview?${query}`,
        controller.signal,
      ),
      fetchJson<AnalyticsBundleDto["uptime"]>(
        `/api/public/analytics/uptime?${query}`,
        controller.signal,
      ),
      fetchJson<AnalyticsBundleDto["responseTime"]>(
        `/api/public/analytics/response-time?${query}`,
        controller.signal,
      ),
      fetchJson<AnalyticsBundleDto["incidents"]>(
        `/api/public/analytics/incidents?${query}`,
        controller.signal,
      ),
      fetchJson<AnalyticsBundleDto["monitors"]>(
        `/api/public/analytics/monitors?${query}`,
        controller.signal,
      ),
    ])
      .then(([overview, uptime, responseTime, incidents, monitors]) => {
        setBundle({ overview, uptime, responseTime, incidents, monitors });
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load analytics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range]);

  const sortedMonitors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bundle.monitors.monitors
      .filter(
        (monitor) =>
          !needle ||
          monitor.name.toLowerCase().includes(needle) ||
          monitor.description.toLowerCase().includes(needle),
      )
      .sort((left, right) => compareMonitors(left, right, sort, order));
  }, [bundle.monitors.monitors, order, search, sort]);

  const columns = useMemo<DataTableColumn<AnalyticsMonitorSummaryDto>[]>(
    () => [
      {
        id: "name",
        header: (
          <SortButton
            label="Endpoint"
            active={sort === "name"}
            onClick={() => toggleSort("name", sort, order, setSort, setOrder)}
          />
        ),
        cell: (monitor) => (
          <div className="space-y-0.5">
            <Link
              className="text-sm font-medium text-foreground hover:text-primary hover:underline"
              href={`/analytics/${monitor.id}?range=${range}`}
            >
              {monitor.name}
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground">{monitor.description}</p>
          </div>
        ),
        cellClassName: "min-w-48",
      },
      {
        id: "status",
        header: "Current",
        cell: (monitor) => (
          <StatusBadge tone={statusTone(monitor.currentStatus)}>
            {monitor.currentStatus === "UNKNOWN" ? "NO DATA" : monitor.currentStatus}
          </StatusBadge>
        ),
      },
      {
        id: "uptime",
        header: (
          <SortButton
            label="Uptime"
            active={sort === "uptimePercentage"}
            onClick={() => toggleSort("uptimePercentage", sort, order, setSort, setOrder)}
          />
        ),
        cell: (monitor) => (
          <span className="tabular-nums">{monitor.uptimePercentage.toFixed(1)}%</span>
        ),
      },
      {
        id: "response",
        header: (
          <SortButton
            label="Avg response"
            active={sort === "averageResponseTimeMs"}
            onClick={() => toggleSort("averageResponseTimeMs", sort, order, setSort, setOrder)}
          />
        ),
        cell: (monitor) =>
          monitor.averageResponseTimeMs === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{monitor.averageResponseTimeMs} ms</span>
          ),
      },
      {
        id: "checks",
        header: (
          <SortButton
            label="Checks"
            active={sort === "totalChecks"}
            onClick={() => toggleSort("totalChecks", sort, order, setSort, setOrder)}
          />
        ),
        cell: (monitor) => <span className="tabular-nums">{monitor.totalChecks}</span>,
      },
      {
        id: "failures",
        header: (
          <SortButton
            label="Failed"
            active={sort === "failedChecks"}
            onClick={() => toggleSort("failedChecks", sort, order, setSort, setOrder)}
          />
        ),
        cell: (monitor) => (
          <span className="tabular-nums">
            {monitor.failedChecks} ({monitor.failureRate.toFixed(1)}%)
          </span>
        ),
      },
      {
        id: "lastChecked",
        header: "Last result",
        cell: (monitor) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(monitor.lastCheckedAt)} UTC
          </span>
        ),
      },
    ],
    [order, range, sort],
  );

  const { stats } = bundle.overview;
  const latestResult = bundle.overview.latestCheckAt
    ? `${formatDateTime(bundle.overview.latestCheckAt)} UTC`
    : "No results recorded";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monitoring analytics"
        title="API monitoring analytics"
        description="Historical reliability and performance calculated from stored monitor checks and incidents. All timestamps are UTC."
        actions={
          <>
            <AnalyticsRangeSelector value={range} onChange={setRange} disabled={loading} />
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Loading
              </span>
            ) : null}
          </>
        }
      />

      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <span>{error}</span>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-1.5 font-medium hover:bg-danger/10"
            onClick={() => setRange(range === "24h" ? "30d" : "24h")}
            type="button"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span>
          Latest stored monitoring result: <span className="font-medium text-foreground">{latestResult}</span>
        </span>
        <span>Analytics update only when checks execute.</span>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Current status</h2>
          <p className="text-sm text-muted-foreground">
            Latest stored status for public API endpoints.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsCard
            label="Operational"
            value={String(stats.operationalMonitors)}
            description={`${stats.totalMonitors} public monitors`}
            icon={CheckCircle2}
            tone="success"
          />
          <StatisticsCard
            label="Down"
            value={String(stats.downMonitors)}
            description="Latest stored status is DOWN"
            icon={XCircle}
            tone="danger"
          />
          <StatisticsCard
            label="No result yet"
            value={String(stats.unknownMonitors)}
            description="Never recorded a check"
            icon={Server}
            tone="warning"
          />
          <StatisticsCard
            label="Active incidents"
            value={String(stats.totalIncidents)}
            description={`MTTR ${formatDuration(stats.mttrMs)} · longest ${formatDuration(stats.longestOutageMs)}`}
            icon={AlertTriangle}
            tone={stats.totalIncidents > 0 ? "danger" : "primary"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Historical uptime</h2>
          <p className="text-sm text-muted-foreground">
            Successful checks divided by determinate checks (UP + DOWN) in the selected range.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsCard
            label="Historical uptime"
            value={`${stats.uptimePercentage.toFixed(1)}%`}
            description={`${stats.successfulChecks} successful of ${stats.totalChecks} checks`}
            icon={Activity}
            tone={stats.uptimePercentage >= 95 ? "success" : "warning"}
          />
          <StatisticsCard
            label="Failed checks"
            value={String(stats.failedChecks)}
            description={`Failure rate ${stats.failureRate.toFixed(1)}%`}
            icon={XCircle}
            tone={stats.failedChecks > 0 ? "danger" : "success"}
          />
          <StatisticsCard
            label="Monitors with history"
            value={`${stats.monitorsWithHistory}/${stats.totalMonitors}`}
            description="Endpoints with at least one stored check"
            icon={Server}
          />
          <StatisticsCard
            label="Uptime in range"
            value={`${bundle.uptime.overall.uptimePercentage.toFixed(1)}%`}
            description={`${bundle.uptime.overall.totalChecks} determinate checks`}
            icon={Clock3}
          />
        </div>
        <UptimeTrendChart data={bundle.uptime.trend} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Historical response time</h2>
          <p className="text-sm text-muted-foreground">
            Calculated only from successful checks with a recorded response time. Missing or failed samples are not invented.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsCard
            label="Average response"
            value={
              stats.averageResponseTimeMs === null
                ? "—"
                : `${stats.averageResponseTimeMs} ms`
            }
            description={`${stats.responseSampleCount} successful samples`}
            icon={Gauge}
          />
          <StatisticsCard
            label="Fastest response"
            value={stats.minResponseTimeMs === null ? "—" : `${stats.minResponseTimeMs} ms`}
            description="Minimum successful sample"
            icon={Timer}
            tone="success"
          />
          <StatisticsCard
            label="Slowest response"
            value={stats.maxResponseTimeMs === null ? "—" : `${stats.maxResponseTimeMs} ms`}
            description="Maximum successful sample"
            icon={Timer}
            tone="warning"
          />
          <StatisticsCard
            label="Samples"
            value={String(stats.responseSampleCount)}
            description="Stored UP checks with response time"
            icon={Activity}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ResponseTimeTrendChart data={bundle.responseTime.trend} />
          <MonitorComparisonChart monitors={bundle.responseTime.perMonitor} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Endpoint comparison</h2>
          <p className="text-sm text-muted-foreground">
            Search, sort, and open any endpoint for its own historical view.
          </p>
        </div>
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Monitor summaries</CardTitle>
              <CardDescription>
                {sortedMonitors.length} of {bundle.monitors.total} public monitors
              </CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Search
              <input
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Endpoint name"
                type="search"
                value={search}
              />
            </label>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                emptyMessage="No public monitors match this search."
                rows={sortedMonitors}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Failure and incident analytics</h2>
          <p className="text-sm text-muted-foreground">
            Active and resolved incidents are derived from stored incident records. Durations use UTC timestamps.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="gap-0 py-0">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base">Incident summary</CardTitle>
              <CardDescription>Incidents overlapping selected range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 text-sm">
              <SummaryRow label="Total incidents" value={String(bundle.incidents.total)} />
              <SummaryRow label="Mean time to resolve" value={formatDuration(bundle.incidents.mttrMs)} />
              <SummaryRow label="Longest outage" value={formatDuration(bundle.incidents.longestOutageMs)} />
            </CardContent>
          </Card>
          <Card className="gap-0 py-0 xl:col-span-2">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base">Most unreliable endpoints</CardTitle>
              <CardDescription>
                Endpoints with stored history, ranked by failure rate in this range.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {bundle.incidents.mostUnreliable.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No stored check history to rank yet.
                </p>
              ) : (
                <ol className="space-y-2">
                  {bundle.incidents.mostUnreliable.map((monitor, index) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      key={monitor.id}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                        <Link className="font-medium hover:text-primary hover:underline" href={`/analytics/${monitor.id}?range=${range}`}>
                          {monitor.name}
                        </Link>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {monitor.failedChecks} failed / {monitor.totalChecks} checks · {monitor.failureRate.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Recent incidents</CardTitle>
            <CardDescription>
              Newest stored incidents overlapping the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {bundle.incidents.incidents.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No incidents in this range.
              </p>
            ) : (
              <ul className="space-y-2">
                {bundle.incidents.incidents.slice(0, 6).map((incident) => (
                  <li
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    key={incident.id}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{incident.title}</span>
                        <StatusBadge tone={severityTone(incident.severity)} dot={false}>
                          {formatLabel(incident.severity.toLowerCase())}
                        </StatusBadge>
                        <StatusBadge
                          tone={incident.status === "ACTIVE" ? "danger" : "success"}
                          dot={false}
                        >
                          {formatLabel(incident.status.toLowerCase())}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {incident.monitorName} · started {formatDateTime(incident.startedAt)} UTC
                        {incident.resolvedAt
                          ? ` · resolved ${formatDateTime(incident.resolvedAt)} UTC`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>Duration {formatDuration(incident.durationMs)}</span>
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/analytics/${incident.monitorId}?range=${range}`}
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${
        active ? "text-foreground" : ""
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      <span aria-hidden="true">{active ? "↓" : "↕"}</span>
    </button>
  );
}

function toggleSort(
  target: AnalyticsSort,
  currentSort: AnalyticsSort,
  currentOrder: "asc" | "desc",
  setSort: (sort: AnalyticsSort) => void,
  setOrder: (order: "asc" | "desc") => void,
) {
  if (currentSort === target) {
    setOrder(currentOrder === "asc" ? "desc" : "asc");
    return;
  }
  setSort(target);
  setOrder(target === "name" ? "asc" : "desc");
}
