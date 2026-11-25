"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicHeader } from "@/components/shared/public-header";
import { overallStatusMessage, statusLabel } from "@/lib/status/calculations";
import { formatDateTime, formatDuration } from "@/lib/monitoring/format";
import type {
  StatusBucketState,
  StatusIncidentDto,
  StatusOverallState,
  StatusRange,
  StatusServiceState,
  StatusSnapshotDto,
  StatusUptimeBucketDto,
} from "@/lib/status/types";

const RANGES: StatusRange[] = ["24h", "7d", "30d"];
const REFRESH_MS = 45_000;
const STALE_AFTER_MS = 120_000;

let clockTime = 0;
let clockTimer: number | undefined;
const clockListeners = new Set<() => void>();

function subscribeClock(onStoreChange: () => void): () => void {
  clockListeners.add(onStoreChange);
  if (clockTimer === undefined) {
    clockTime = Date.now();
    clockTimer = window.setInterval(() => {
      clockTime = Date.now();
      for (const listener of clockListeners) listener();
    }, 15_000);
  }
  return () => {
    clockListeners.delete(onStoreChange);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

function getClockSnapshot(): number {
  return clockTime;
}

function getServerClockSnapshot(): number {
  return 0;
}

const rangeLabels: Record<StatusRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

const stateStyles: Record<
  StatusServiceState | StatusOverallState | StatusBucketState,
  { dot: string; pill: string; banner: string }
> = {
  UP: {
    dot: "bg-success",
    pill: "border-success/25 bg-success/10 text-success",
    banner: "border-success/25 bg-success/10",
  },
  OPERATIONAL: {
    dot: "bg-success",
    pill: "border-success/25 bg-success/10 text-success",
    banner: "border-success/25 bg-success/10",
  },
  DEGRADED: {
    dot: "bg-warning",
    pill: "border-warning/30 bg-warning/10 text-warning",
    banner: "border-warning/30 bg-warning/10",
  },
  DOWN: {
    dot: "bg-danger",
    pill: "border-danger/25 bg-danger/10 text-danger",
    banner: "border-danger/25 bg-danger/10",
  },
  OUTAGE: {
    dot: "bg-danger",
    pill: "border-danger/25 bg-danger/10 text-danger",
    banner: "border-danger/25 bg-danger/10",
  },
  UNKNOWN: {
    dot: "bg-muted-foreground",
    pill: "border-border bg-muted text-muted-foreground",
    banner: "border-border bg-muted",
  },
  NO_DATA: {
    dot: "bg-muted-foreground",
    pill: "border-border bg-muted text-muted-foreground",
    banner: "border-border bg-muted",
  },
};

const bucketStyles: Record<StatusBucketState, string> = {
  UP: "bg-success",
  DEGRADED: "bg-warning",
  DOWN: "bg-danger",
  UNKNOWN: "border border-dashed border-border bg-muted",
};

async function fetchSnapshot(range: StatusRange, signal?: AbortSignal): Promise<StatusSnapshotDto> {
  const response = await fetch(`/api/public/status?range=${range}`, {
    signal,
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: StatusSnapshotDto; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error?.message ?? "Unable to load status data.");
  }
  return payload.data;
}

export function StatusPage({ initialSnapshot }: { initialSnapshot: StatusSnapshotDto }) {
  const [range, setRange] = useState<StatusRange>("24h");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
  const inFlight = useRef(false);
  const firstRange = useRef(true);

  const refresh = useCallback(async (nextRange: StatusRange) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot(nextRange);
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh status data.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firstRange.current) {
      firstRange.current = false;
      return;
    }
    void refresh(range);
  }, [range, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(range);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [range, refresh]);

  const { overview, monitors, incidents } = snapshot;
  const lastUpdated = now ? formatDateTime(overview.generatedAt) : "Loading";
  const age = ageLabel(overview.generatedAt, now);
  const stale = now > 0 && now - Date.parse(overview.generatedAt) > STALE_AFTER_MS;
  const bannerStyle = stateStyles[overview.status];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">Public status</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Service health</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Availability and incident information derived from stored monitor checks. All times
              are UTC.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-4" aria-hidden="true" />
              Updated {lastUpdated} UTC · {age}
            </span>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
              disabled={loading}
              onClick={() => void refresh(range)}
              type="button"
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6">

          {error ? (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              <span>{error} Showing the last successful update.</span>
              <button
                className="font-medium underline underline-offset-4"
                onClick={() => void refresh(range)}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}

          {stale ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              This data is older than two minutes. Monitoring checks may not have run recently.
            </div>
          ) : null}

          <section className={`rounded-2xl border p-5 sm:p-6 ${bannerStyle.banner}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`size-3 rounded-full ${bannerStyle.dot}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Overall system status</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {statusLabel(overview.status)}
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              {overallStatusMessage(overview.status)}
            </p>
            </div>
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatusMetric
              icon={CheckCircle2}
              label="Operational"
              value={String(overview.counts.operational)}
              hint={`${overview.counts.total} public services`}
              accent="text-emerald-600"
            />
            <StatusMetric
              icon={AlertTriangle}
              label="Degraded"
              value={String(overview.counts.degraded)}
              hint="Recent failures recorded"
              accent="text-amber-600"
            />
            <StatusMetric
              icon={XCircle}
              label="Outages"
              value={String(overview.counts.down)}
              hint={`${overview.activeIncidents} active incidents`}
              accent="text-red-600"
            />
            <StatusMetric
              icon={ShieldCheck}
              label="Overall uptime"
              value={`${overview.uptimePercentage.toFixed(1)}%`}
              hint="Last 24 hours of checks"
            />
            <StatusMetric
              icon={Gauge}
              label="Average response"
              value={
                overview.averageResponseTimeMs === null
                  ? "—"
                  : `${overview.averageResponseTimeMs} ms`
              }
              hint="Successful checks only"
            />
            <StatusMetric
              icon={Clock3}
              label="Last check"
              value={
                overview.latestCheckAt
                  ? `${formatDateTime(overview.latestCheckAt)} UTC`
                  : "No data"
              }
              hint={`Updated ${age}`}
            />
          </section>

          <section className="mt-12">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  Service status
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Uptime bars use stored check results. Gray bars mean no checks were recorded.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {RANGES.map((option) => (
                  <button
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      range === option
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    key={option}
                    onClick={() => setRange(option)}
                    type="button"
                  >
                    {rangeLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {monitors.length === 0 ? (
                <Card>
                  <CardContent className="px-5 py-12 text-center text-sm text-slate-500">
                    No public monitors are configured yet.
                  </CardContent>
                </Card>
              ) : (
                monitors.map((monitor) => (
                  <Card className="border-slate-200 bg-white shadow-sm" key={monitor.id}>
                    <CardHeader className="px-5 pt-5 pb-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle className="text-base text-slate-900">{monitor.name}</CardTitle>
                          <CardDescription className="mt-1 text-slate-500">
                            {monitor.description || "No description provided."}
                          </CardDescription>
                        </div>
                        <StatePill state={monitor.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5 px-5 pb-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MiniStat
                          label="Latest response"
                          value={
                            monitor.lastResponseTimeMs === null
                              ? "—"
                              : `${monitor.lastResponseTimeMs} ms`
                          }
                        />
                        <MiniStat label="Uptime 24h" value={`${monitor.uptime["24h"].toFixed(1)}%`} />
                        <MiniStat label="Uptime 7d" value={`${monitor.uptime["7d"].toFixed(1)}%`} />
                        <MiniStat label="Uptime 30d" value={`${monitor.uptime["30d"].toFixed(1)}%`} />
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                        <span>
                          Last successful check: {formatDateTime(monitor.lastSuccessfulCheckAt)} UTC
                        </span>
                        <span>Last check: {formatDateTime(monitor.lastCheckedAt)} UTC</span>
                      </div>
                      <UptimeBars buckets={monitor.history} range={range} />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Incident history
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Actual stored incidents from the last 30 days. Updates are derived from incident
                timestamps and occurrence counts.
              </p>
            </div>
            <IncidentList incidents={incidents} />
          </section>
        </div>

        <footer className="mt-14 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {overview.generatedAt.slice(0, 4)} PulseWatch · Monitor. Test. Stay Ahead.</span>
          <Link
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            href="/login"
          >
            Admin sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </footer>
      </main>
    </div>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 ${accent ?? "text-slate-600"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-slate-900 tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function StatePill({ state }: { state: StatusServiceState }) {
  const style = stateStyles[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.pill}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {statusLabel(state)}
    </span>
  );
}

function UptimeBars({
  buckets,
  range,
}: {
  buckets: StatusUptimeBucketDto[];
  range: StatusRange;
}) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No uptime data for this period.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1" role="img" aria-label={`Uptime history for ${rangeLabels[range]}`}>
        {buckets.map((bucket) => {
          const tooltip = `${bucket.label} — ${statusLabel(bucket.state)}: ${bucket.successfulChecks} successful, ${bucket.failedChecks} failed, ${bucket.totalChecks} checks`;
          return (
            <span
              className={`h-8 min-w-[5px] flex-1 rounded-sm ${bucketStyles[bucket.state]}`}
              key={bucket.bucket}
              title={tooltip}
              aria-label={tooltip}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <Legend color="bg-emerald-500" label="Operational" />
        <Legend color="bg-amber-400" label="Degraded" />
        <Legend color="bg-red-500" label="Outage" />
        <Legend color="border border-dashed border-slate-300 bg-slate-100" label="No data" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function IncidentList({ incidents }: { incidents: StatusIncidentDto[] }) {
  if (incidents.length === 0) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col items-center px-5 py-12 text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-slate-900">No incidents recorded</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            There are no stored incidents for public services in the last 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <Card className="border-slate-200 bg-white shadow-sm" key={incident.id}>
          <CardContent className="px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${
                      incident.status === "ACTIVE"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {incident.status === "ACTIVE" ? "Ongoing" : "Resolved"}
                  </span>
                  <span className="text-xs text-slate-400">{incident.severity}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {incident.monitorName} · started {formatDateTime(incident.startedAt)} UTC
                  {incident.resolvedAt ? ` · resolved ${formatDateTime(incident.resolvedAt)} UTC` : ""}
                  {" · "}duration {formatDuration(incident.durationMs)}
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-400">
                {incident.occurrenceCount} failed check
                {incident.occurrenceCount === 1 ? "" : "s"}
              </p>
            </div>
            {incident.updates.length > 0 ? (
              <ol className="mt-4 space-y-2 border-l border-slate-200 pl-4">
                {incident.updates.map((update) => (
                  <li className="relative text-xs text-slate-600" key={update.id}>
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-slate-300" />
                    <span className="font-medium text-slate-800">{update.label}</span> ·{" "}
                    {formatDateTime(update.at)} UTC
                    {update.detail ? <span className="text-slate-500"> — {update.detail}</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ageLabel(generatedAt: string, now: number): string {
  if (!now) return "loading age";
  const seconds = Math.max(0, Math.round((now - Date.parse(generatedAt)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
