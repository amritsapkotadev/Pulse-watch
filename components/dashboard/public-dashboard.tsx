"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  Gauge,
  RefreshCw,
  Server,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { PublicHeader } from "@/components/shared/public-header";
import {
  publicOverallTone,
  publicStateLabel,
  publicStateTone,
  StatusPill,
} from "@/components/shared/public-status-pill";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatDuration, formatRelativeTime } from "@/lib/monitoring/format";
import type { AnalyticsRange, PublicDashboardDto } from "@/lib/monitoring/types";
import { cn } from "@/lib/utils";

const RANGES: AnalyticsRange[] = ["24h", "7d", "30d", "90d"];
const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};
const REFRESH_MS = 45_000;
const PAGE_SIZE = 8;
const HEALTH_RANK = { DOWN: 0, DEGRADED: 1, UNKNOWN: 2, UP: 3 } as const;

type SortMode = "health" | "uptime" | "latency";
type Tone = "success" | "warning" | "danger" | "neutral";

const TONE_SURFACE: Record<Tone, string> = {
  success: "border-success/25 bg-success/10",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-danger/25 bg-danger/10",
  neutral: "border-border bg-muted",
};

const TONE_BAR: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-muted-foreground",
};

async function fetchDashboard(
  range: AnalyticsRange,
  signal: AbortSignal,
): Promise<PublicDashboardDto> {
  const response = await fetch(`/api/public/dashboard?range=${range}`, {
    signal,
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: PublicDashboardDto; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error?.message ?? "Unable to load dashboard data.");
  }
  return payload.data;
}

export function PublicDashboard({ initialData }: { initialData: PublicDashboardDto }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState<AnalyticsRange>(initialData.range);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("health");
  const [page, setPage] = useState(1);
  const activeRequest = useRef<AbortController | null>(null);
  const firstRange = useRef(true);

  const load = useCallback(async (nextRange: AnalyticsRange) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextData = await fetchDashboard(nextRange, controller.signal);
      if (!controller.signal.aborted) setData(nextData);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to refresh dashboard data.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (firstRange.current) {
      firstRange.current = false;
      return;
    }
    setPage(1);
    void load(range);
    return () => activeRequest.current?.abort();
  }, [range, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(range);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [range, load]);

  const sortedMonitors = useMemo(() => {
    const monitors = [...data.monitors];
    if (sortMode === "uptime") {
      monitors.sort((left, right) => right.uptimePercentage - left.uptimePercentage);
    } else if (sortMode === "latency") {
      monitors.sort(
        (left, right) => (right.averageResponseTimeMs ?? -1) - (left.averageResponseTimeMs ?? -1),
      );
    } else {
      monitors.sort(
        (left, right) =>
          HEALTH_RANK[left.status] - HEALTH_RANK[right.status] ||
          right.failedChecks - left.failedChecks,
      );
    }
    return monitors;
  }, [data.monitors, sortMode]);

  const responseChartData = useMemo(
    () =>
      data.responseTrend.flatMap((bucket) =>
        bucket.averageResponseTimeMs === null
          ? []
          : [{ label: bucket.label, latency: bucket.averageResponseTimeMs }],
      ),
    [data.responseTrend],
  );
  const uptimeChartData = useMemo(
    () =>
      data.uptimeTrend.map((bucket) => ({
        label: bucket.label,
        uptime: bucket.uptimePercentage,
      })),
    [data.uptimeTrend],
  );
  const slowestMonitors = useMemo(
    () =>
      data.monitors
        .filter((monitor) => monitor.averageResponseTimeMs !== null)
        .sort(
          (left, right) => (right.averageResponseTimeMs ?? 0) - (left.averageResponseTimeMs ?? 0),
        )
        .slice(0, 4),
    [data.monitors],
  );
  const leastReliableMonitors = useMemo(
    () =>
      data.monitors
        .filter((monitor) => monitor.totalChecks > 0)
        .sort((left, right) => left.uptimePercentage - right.uptimePercentage)
        .slice(0, 4),
    [data.monitors],
  );
  const maxLatency = Math.max(1, ...slowestMonitors.map((monitor) => monitor.averageResponseTimeMs ?? 0));

  const pageCount = Math.max(1, Math.ceil(sortedMonitors.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedMonitors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const tone = publicOverallTone(data.status);
  const failureRate =
    data.stats.totalChecks === 0
      ? 0
      : (data.stats.failedChecks / data.stats.totalChecks) * 100;
  const healthRows: Array<{ label: string; count: number; tone: Tone }> = [
    { label: "Operational", count: data.stats.operationalMonitors, tone: "success" },
    { label: "Degraded", count: data.stats.degradedMonitors, tone: "warning" },
    { label: "Outage", count: data.stats.downMonitors, tone: "danger" },
    { label: "No data", count: data.stats.noDataMonitors, tone: "neutral" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground antialiased">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Public monitoring overview
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[2rem] sm:leading-tight">
              Service health and performance
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Live measurements from stored checks. Only monitors marked for public display are
              included.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <RangeSelector range={range} onChange={setRange} label="Dashboard time range" />
            <Button
              variant="outline"
              onClick={() => void load(range)}
              disabled={loading}
              className="h-10 gap-2"
            >
              <RefreshCw className={cn("size-4", loading ? "animate-spin" : "")} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning">
            {error} Showing the last successful update.
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <div className={cn("rounded-xl border p-5 sm:p-6", TONE_SURFACE[tone])}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center">
                <StatusPill tone={tone}>{statusHeading(data.status)}</StatusPill>
                <div className="space-y-1.5">
                  <p className="text-lg font-semibold tracking-tight sm:text-xl">{data.statusMessage}</p>
                  <p className="text-sm text-muted-foreground">
                    Derived from current monitor states and recent check history.
                  </p>
                </div>
              </div>
              <div className="shrink-0 border-t border-border/60 pt-3 text-left text-xs leading-5 text-muted-foreground sm:border-0 sm:pt-0 sm:text-right">
                <p>Updated {formatDateTime(data.generatedAt)} UTC</p>
                <p className="mt-0.5">{formatRelativeTime(data.generatedAt)}</p>
              </div>
            </div>
          </div>
          <Card className="h-full gap-0 py-0">
            <CardContent className="px-5 py-5 sm:px-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Monitor breakdown</p>
                  <p className="text-sm font-semibold text-foreground">{formatCount(data.stats.totalMonitors)} public services</p>
                </div>
                <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                {healthRows.map((row) => (
                  <DistributionRow
                    key={row.label}
                    label={row.label}
                    count={row.count}
                    total={data.stats.totalMonitors}
                    tone={row.tone}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Availability"
            value={formatPercent(data.stats.uptimePercentage)}
            hint={`${RANGE_LABELS[data.range]} · ${formatCount(data.stats.totalChecks)} checks`}
            icon={ShieldCheck}
            meter={data.stats.uptimePercentage}
            tone="success"
          />
          <MetricCard
            label="Average response"
            value={formatMs(data.stats.averageResponseTimeMs)}
            hint={`${formatCount(data.analytics.responseSampleCount)} successful samples`}
            icon={Clock3}
          />
          <MetricCard
            label="95th percentile"
            value={formatMs(data.stats.p95ResponseTimeMs)}
            hint="Successful checks only"
            icon={Gauge}
          />
          <MetricCard
            label="Failed checks"
            value={formatCount(data.stats.failedChecks)}
            hint={`${formatPercent(failureRate)} of checks in range`}
            icon={AlertTriangle}
            meter={failureRate}
            tone="danger"
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="h-full gap-0 py-0">
            <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6">
              <div className="space-y-1">
                <CardTitle className="text-base">Response time</CardTitle>
                <CardDescription>Average latency from successful checks over {RANGE_LABELS[data.range].toLowerCase()}.</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">UTC</span>
            </CardHeader>
            <CardContent className="px-3 pb-5 sm:px-5">
              <TrendAreaChart
                data={responseChartData}
                dataKey="latency"
                label="Response time trend"
                color="var(--chart-1)"
                tickFormatter={(value) => `${value} ms`}
                tooltipFormatter={(value) => [`${value} ms`, "Average"]}
                emptyLabel="No successful checks recorded for this period."
                domain={["auto", "auto"]}
              />
            </CardContent>
          </Card>

          <Card className="h-full gap-0 py-0">
            <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6">
              <div className="space-y-1">
                <CardTitle className="text-base">Availability</CardTitle>
                <CardDescription>Successful checks per bucket, excluding unknown results.</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">%</span>
            </CardHeader>
            <CardContent className="px-3 pb-5 sm:px-5">
              <TrendAreaChart
                data={uptimeChartData}
                dataKey="uptime"
                label="Availability trend"
                color="var(--success)"
                tickFormatter={(value) => `${value}%`}
                tooltipFormatter={(value) => [`${value}%`, "Available"]}
                emptyLabel="No check history recorded for this period."
                domain={[0, 100]}
              />
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Analytics</h2>
                <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Derived from stored checks for the selected {RANGE_LABELS[data.range].toLowerCase()}.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCount(data.analytics.totalIncidents)} incidents ·{" "}
              {formatCount(data.stats.totalChecks)} total checks
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="h-full gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-4 sm:px-6">
                <CardTitle className="text-base">Latency profile</CardTitle>
                <CardDescription>Distribution of successful response times.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-5 pb-5 sm:px-6">
                <div className="grid grid-cols-2 gap-2.5">
                  <MiniStat label="Fastest" value={formatMs(data.analytics.minResponseTimeMs)} />
                  <MiniStat label="Average" value={formatMs(data.stats.averageResponseTimeMs)} />
                  <MiniStat label="P95" value={formatMs(data.stats.p95ResponseTimeMs)} />
                  <MiniStat label="Slowest" value={formatMs(data.analytics.maxResponseTimeMs)} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Slowest endpoints</p>
                  {slowestMonitors.length === 0 ? (
                    <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
                      No latency samples yet.
                    </p>
                  ) : (
                    slowestMonitors.map((monitor) => (
                      <RankingRow
                        key={monitor.id}
                        label={monitor.name}
                        value={formatMs(monitor.averageResponseTimeMs)}
                        ratio={(monitor.averageResponseTimeMs ?? 0) / maxLatency}
                        tone="warning"
                      />
                    ))
                  )}
                </div>
                {data.analytics.slowestMonitor ? (
                  <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                    Slowest: <span className="font-medium text-foreground">{data.analytics.slowestMonitor.name}</span>{" "}
                    at {formatMs(data.analytics.slowestMonitor.averageResponseTimeMs)}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="h-full gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-4 sm:px-6">
                <CardTitle className="text-base">Reliability profile</CardTitle>
                <CardDescription>Uptime ranked from lowest to highest.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-5 pb-5 sm:px-6">
                <div className="grid grid-cols-2 gap-2.5">
                  <MiniStat label="Successful" value={formatCount(data.stats.totalChecks - data.stats.failedChecks)} />
                  <MiniStat label="Failed" value={formatCount(data.stats.failedChecks)} />
                  <MiniStat
                    label="Uptime"
                    value={formatPercent(data.stats.uptimePercentage)}
                  />
                  <MiniStat label="Failure rate" value={formatPercent(failureRate)} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
                  {leastReliableMonitors.length === 0 ? (
                    <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
                      No monitor history yet.
                    </p>
                  ) : (
                    leastReliableMonitors.map((monitor) => (
                      <RankingRow
                        key={monitor.id}
                        label={monitor.name}
                        value={formatPercent(monitor.uptimePercentage)}
                        ratio={monitor.uptimePercentage / 100}
                        tone={monitor.uptimePercentage >= 99 ? "success" : monitor.uptimePercentage >= 95 ? "warning" : "danger"}
                      />
                    ))
                  )}
                </div>
                {data.analytics.leastReliableMonitor ? (
                  <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                    Lowest uptime:{" "}
                    <span className="font-medium text-foreground">{data.analytics.leastReliableMonitor.name}</span>{" "}
                    at {formatPercent(data.analytics.leastReliableMonitor.uptimePercentage)}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="h-full gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-4 sm:px-6">
                <CardTitle className="text-base">Incident profile</CardTitle>
                <CardDescription>Stored incidents affecting public monitors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-5 pb-5 sm:px-6">
                <div className="grid grid-cols-2 gap-2.5">
                  <MiniStat label="Total" value={formatCount(data.analytics.totalIncidents)} />
                  <MiniStat label="Active" value={formatCount(data.analytics.activeIncidents)} />
                  <MiniStat
                    label="Mean resolution"
                    value={formatDuration(data.analytics.meanTimeToResolveMs)}
                  />
                  <MiniStat
                    label="Longest outage"
                    value={formatDuration(data.analytics.longestOutageMs)}
                  />
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">Most affected service</p>
                  <p className="mt-1 text-sm font-medium">
                    {data.analytics.mostAffectedMonitor?.name ?? "None recorded"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.analytics.mostAffectedMonitor
                      ? `${formatCount(data.analytics.mostAffectedMonitor.incidentCount)} incidents in range`
                      : "No incidents in the selected range."}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Latest incidents</p>
                  {data.incidents.length === 0 ? (
                    <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
                      No incidents recorded in this period.
                    </p>
                  ) : (
                    data.incidents.slice(0, 3).map((incident) => (
                      <div
                        key={incident.id}
                        className="flex items-center justify-between gap-4 rounded-md px-2 py-2.5 odd:bg-muted/20"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{incident.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {incident.monitorName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatDuration(incident.durationMs)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Monitors</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Current state, uptime, and failures for the selected range.
              </p>
            </div>
            <div className="shrink-0">
              <RangeSelector
                range={sortMode}
                onChange={(next) => {
                  setSortMode(next as SortMode);
                  setPage(1);
                }}
                options={[
                  ["health", "Health"],
                  ["uptime", "Uptime"],
                  ["latency", "Latency"],
                ]}
                label="Sort monitors"
              />
            </div>
          </div>
          <Card className="h-full gap-0 py-0">
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3.5 text-left font-medium">Service</th>
                      <th className="px-5 py-3.5 text-left font-medium">Status</th>
                      <th className="px-5 py-3.5 text-right font-medium">Uptime</th>
                      <th className="px-5 py-3.5 text-right font-medium">Avg</th>
                      <th className="px-5 py-3.5 text-right font-medium">Failed</th>
                      <th className="px-5 py-3.5 text-right font-medium">Last check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                          No public monitors are configured yet.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((monitor) => (
                        <tr key={monitor.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-5 py-3.5 align-middle">
                            <span className="font-medium text-foreground">{monitor.name}</span>
                            {monitor.description ? (
                              <span className="mt-1 block max-w-sm truncate text-xs text-muted-foreground">
                                {monitor.description}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5 align-middle">
                            <StatusPill tone={publicStateTone(monitor.status)}>
                              {publicStateLabel(monitor.status)}
                            </StatusPill>
                          </td>
                          <td className="px-5 py-3.5 text-right align-middle tabular-nums">
                            <span>{formatPercent(monitor.uptimePercentage)}</span>
                            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  monitor.uptimePercentage >= 99
                                    ? "bg-success"
                                    : monitor.uptimePercentage >= 95
                                      ? "bg-warning"
                                      : "bg-danger",
                                )}
                                style={{ width: `${Math.max(0, Math.min(100, monitor.uptimePercentage))}%` }}
                              />
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right align-middle tabular-nums">
                            {formatMs(monitor.averageResponseTimeMs)}
                          </td>
                          <td className="px-5 py-3.5 text-right align-middle tabular-nums">
                            {formatCount(monitor.failedChecks)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-xs align-middle text-muted-foreground">
                            {formatDateTime(monitor.lastCheckedAt)} UTC
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {sortedMonitors.length === 0
                    ? "0 monitors"
                    : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, sortedMonitors.length)} of ${sortedMonitors.length}`}
                </p>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {currentPage} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {data.generatedAt.slice(0, 4)} PulseWatch · API monitoring</span>
          <Link href="/status" className="inline-flex items-center gap-1.5 font-medium hover:text-foreground">
            View detailed status page
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </footer>
      </main>
    </div>
  );
}

function statusHeading(state: PublicDashboardDto["status"]): string {
  return state === "OPERATIONAL"
    ? "Operational"
    : state === "DEGRADED"
      ? "Degraded"
      : state === "OUTAGE"
        ? "Outage"
        : "No data";
}

function formatMs(value: number | null): string {
  return value === null ? "—" : `${value} ms`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function RangeSelector<T extends string>({
  range,
  onChange,
  options,
  label,
}: {
  range: T;
  onChange: (next: T) => void;
  options?: Array<[T, string]>;
  label: string;
}) {
  const values = options ?? (RANGES.map((value) => [value, value.toUpperCase()] as [T, string]));
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border bg-white p-1"
      role="group"
      aria-label={label}
    >
      {values.map(([value, text]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={range === value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            range === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  meter,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  meter?: number;
  tone?: Tone;
}) {
  return (
    <Card className="h-full gap-0 py-0">
      <CardContent className="flex h-full flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="metric-number mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-8">{value}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
        {meter !== undefined ? (
          <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", tone ? TONE_BAR[tone] : "bg-primary")}
              style={{ width: `${Math.max(0, Math.min(100, meter))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-white px-3 py-3">
      <p className="truncate text-[0.7rem] font-medium text-muted-foreground">{label}</p>
      <p className="metric-number mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DistributionRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: Tone;
}) {
  const width = total === 0 ? 0 : (count / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{formatCount(count)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RankingRow({
  label,
  value,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  ratio: number;
  tone: Tone;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", TONE_BAR[tone])}
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}

function TrendAreaChart({
  data,
  dataKey,
  label,
  color,
  tickFormatter,
  tooltipFormatter,
  emptyLabel,
  domain,
}: {
  data: Array<{ label: string; latency?: number; uptime?: number }>;
  dataKey: "latency" | "uptime";
  label: string;
  color: string;
  tickFormatter: (value: number) => string;
  tooltipFormatter: (value: number) => [string, string];
  emptyLabel: string;
  domain: [number | "auto", number | "auto"];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            interval={Math.max(0, Math.floor(data.length / 6))}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickFormatter={tickFormatter}
            width={58}
            domain={domain}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
              padding: 8,
            }}
            formatter={(value) => tooltipFormatter(Number(value))}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.08}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
