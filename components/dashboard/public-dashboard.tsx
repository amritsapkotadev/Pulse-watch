"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, ArrowRight, Clock3, RefreshCw } from "lucide-react";

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
      monitors.sort((left, right) => left.uptimePercentage - right.uptimePercentage);
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

  const pageCount = Math.max(1, Math.ceil(sortedMonitors.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedMonitors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const chartData = useMemo(
    () =>
      data.responseTrend
        .map((bucket) => ({
          label: bucket.label,
          responseTime: bucket.averageResponseTimeMs,
          uptimePercentage: bucket.uptimePercentage,
        }))
        .filter((point) => point.responseTime !== null),
    [data.responseTrend],
  );
  const tone = publicOverallTone(data.status);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Public monitoring overview
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Service health and performance
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Live measurements from stored checks. Only monitors marked for public display are
              included.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-border bg-white p-1"
              role="group"
              aria-label="Dashboard time range"
            >
              {RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  aria-pressed={range === option}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    range === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {RANGE_LABELS[option]}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load(range)}
              disabled={loading}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {error} Showing the last successful update.
          </div>
        ) : null}

        <section
          className={`mt-6 rounded-lg border p-5 ${
            tone === "success"
              ? "border-success/25 bg-success/10"
              : tone === "warning"
                ? "border-warning/30 bg-warning/10"
                : tone === "danger"
                  ? "border-danger/25 bg-danger/10"
                  : "border-border bg-muted"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <StatusPill tone={tone}>{statusHeading(data.status)}</StatusPill>
              <div>
                <p className="text-lg font-semibold tracking-tight">{data.statusMessage}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Derived from current monitor states and recent check history.
                </p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Updated {formatDateTime(data.generatedAt)} UTC ·{" "}
              {formatRelativeTime(data.generatedAt)}
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Uptime"
            value={data.stats.uptimePercentage.toFixed(1)}
            suffix="%"
            hint={`${RANGE_LABELS[data.range]} · ${data.stats.totalChecks.toLocaleString()} checks`}
            icon={Activity}
          />
          <MetricCard
            label="Average response"
            value={formatMs(data.stats.averageResponseTimeMs)}
            hint="Successful checks only"
            icon={Clock3}
          />
          <MetricCard
            label="95th percentile"
            value={formatMs(data.stats.p95ResponseTimeMs)}
            hint="Successful checks only"
            icon={Activity}
          />
          <MetricCard
            label="Active incidents"
            value={String(data.stats.activeIncidents)}
            hint={`${data.stats.failedChecks.toLocaleString()} failed checks in range`}
            icon={AlertTriangle}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base">Response time trend</CardTitle>
                <CardDescription>
                  Average latency from successful checks over {RANGE_LABELS[data.range].toLowerCase()}.
                </CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">UTC</span>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-4">
              {chartData.length === 0 ? (
                <div className="flex h-[248px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  No successful checks recorded for this period.
                </div>
              ) : (
                <div className="h-[248px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                        interval={Math.max(0, Math.floor(chartData.length / 6))}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                        tickFormatter={(value: number) => `${value} ms`}
                        width={58}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          fontSize: 12,
                        }}
                        formatter={(value) => [`${value} ms`, "Average"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="responseTime"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base">Recent incidents</CardTitle>
              <CardDescription>Stored incidents affecting public monitors.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {data.incidents.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  No incidents recorded in this period.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.incidents.map((incident) => (
                    <li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" key={incident.id}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{incident.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {incident.monitorName} · {formatDateTime(incident.startedAt)} UTC
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusPill
                          tone={
                            incident.status === "ACTIVE"
                              ? "danger"
                              : incident.severity === "CRITICAL"
                                ? "danger"
                                : incident.severity === "WARNING"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {incident.status === "ACTIVE" ? "Ongoing" : "Resolved"}
                        </StatusPill>
                        <span className="text-[0.7rem] text-muted-foreground">
                          {formatDuration(incident.durationMs)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Monitors</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Current state, uptime, and failures for the selected range.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-white p-1" role="group" aria-label="Sort monitors">
              {(
                [
                  ["health", "Health"],
                  ["uptime", "Uptime"],
                  ["latency", "Latency"],
                ] as Array<[SortMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSortMode(mode);
                    setPage(1);
                  }}
                  aria-pressed={sortMode === mode}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Card className="gap-0 py-0">
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Service</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Uptime</th>
                      <th className="px-4 py-3 text-right font-medium">Avg</th>
                      <th className="px-4 py-3 text-right font-medium">Failed</th>
                      <th className="px-4 py-3 text-right font-medium">Last check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          No public monitors are configured yet.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((monitor) => (
                        <tr key={monitor.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{monitor.name}</span>
                            {monitor.description ? (
                              <span className="mt-0.5 block max-w-xs truncate text-xs text-muted-foreground">
                                {monitor.description}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill tone={publicStateTone(monitor.status)}>
                              {publicStateLabel(monitor.status)}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {monitor.uptimePercentage.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatMs(monitor.averageResponseTimeMs)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {monitor.failedChecks.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {formatDateTime(monitor.lastCheckedAt)} UTC
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {sortedMonitors.length === 0
                    ? "0 monitors"
                    : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, sortedMonitors.length)} of ${sortedMonitors.length}`}
                </p>
                <div className="flex items-center gap-2">
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

        <footer className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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

function MetricCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="metric-number mt-0.5 text-xl font-semibold">
            {value}
            {suffix ? <span className="ml-0.5 text-sm text-muted-foreground">{suffix}</span> : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
