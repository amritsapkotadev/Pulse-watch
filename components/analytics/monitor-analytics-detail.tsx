"use client";

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Timer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AnalyticsRangeSelector } from "@/components/analytics/analytics-range-selector";
import {
  ResponseTimeTrendChart,
  UptimeTrendChart,
} from "@/components/analytics/analytics-charts";
import { PageHeader } from "@/components/shared/page-header";
import { StatisticsCard } from "@/components/shared/statistics-card";
import { formatLabel, StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatDuration } from "@/lib/monitoring/format";
import type { AnalyticsRange, MonitorAnalyticsDto } from "@/lib/monitoring/types";

export function MonitorAnalyticsDetail({ data }: { data: MonitorAnalyticsDto }) {
  const router = useRouter();
  const [range, setRange] = useState<AnalyticsRange>(data.range);
  const [pending, startTransition] = useTransition();
  const { monitor, summary } = data;
  const currentTone: StatusTone =
    monitor.currentStatus === "UP"
      ? "success"
      : monitor.currentStatus === "DOWN"
        ? "danger"
        : "neutral";

  function changeRange(nextRange: AnalyticsRange) {
    setRange(nextRange);
    startTransition(() => {
      router.push(`/analytics/${monitor.id}?range=${nextRange}`);
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monitor analytics"
        title={monitor.name}
        description={`${monitor.description} · All timestamps and buckets are UTC.`}
        actions={
          <>
            <AnalyticsRangeSelector value={range} onChange={changeRange} disabled={pending} />
            {pending ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Loading
              </span>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <StatusBadge tone={currentTone}>
            {monitor.currentStatus === "UNKNOWN" ? "NO DATA" : monitor.currentStatus}
          </StatusBadge>
          Latest result:{" "}
          <span className="font-medium text-foreground">
            {formatDateTime(monitor.lastCheckedAt)} UTC
          </span>
        </span>
        <Link className="inline-flex items-center gap-2 font-medium text-primary hover:underline" href={`/analytics?range=${range}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all analytics
        </Link>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Historical summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsCard
            label="Uptime"
            value={`${summary.uptimePercentage.toFixed(1)}%`}
            description={`${summary.successfulChecks} successful of ${summary.totalChecks} checks`}
            icon={Activity}
            tone={summary.uptimePercentage >= 95 ? "success" : "warning"}
          />
          <StatisticsCard
            label="Failed checks"
            value={String(summary.failedChecks)}
            description={`Failure rate ${summary.failureRate.toFixed(1)}%`}
            icon={XCircle}
            tone={summary.failedChecks > 0 ? "danger" : "success"}
          />
          <StatisticsCard
            label="Average response"
            value={summary.averageResponseTimeMs === null ? "—" : `${summary.averageResponseTimeMs} ms`}
            description={`${summary.responseSampleCount} successful samples`}
            icon={Gauge}
          />
          <StatisticsCard
            label="Fastest / slowest"
            value={
              summary.minResponseTimeMs === null || summary.maxResponseTimeMs === null
                ? "—"
                : `${summary.minResponseTimeMs} / ${summary.maxResponseTimeMs} ms`
            }
            description="Successful checks only"
            icon={Timer}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Check timeline</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <UptimeTrendChart data={data.trend} />
          <ResponseTimeTrendChart data={data.trend} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Check markers</CardTitle>
            <CardDescription>Stored check results in the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                Last successful check
              </span>
              <span className="font-medium tabular-nums">
                {formatDateTime(summary.lastSuccessfulCheck)} UTC
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="size-4 text-danger" aria-hidden="true" />
                Last failed check
              </span>
              <span className="font-medium tabular-nums">
                {formatDateTime(summary.lastFailedCheck)} UTC
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" />
                Total determinate checks
              </span>
              <span className="font-medium tabular-nums">
                {summary.successfulChecks + summary.failedChecks}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Incident timeline</CardTitle>
            <CardDescription>
              Stored incidents for this endpoint overlapping the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {data.incidents.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No incidents for this endpoint in this range.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.incidents.map((incident) => (
                  <li className="rounded-lg border border-border px-3 py-2 text-sm" key={incident.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{incident.title}</span>
                      <StatusBadge
                        tone={
                          incident.severity === "CRITICAL"
                            ? "danger"
                            : incident.severity === "WARNING"
                              ? "warning"
                              : "info"
                        }
                        dot={false}
                      >
                        {formatLabel(incident.severity.toLowerCase())}
                      </StatusBadge>
                      <StatusBadge
                        tone={incident.status === "ACTIVE" ? "danger" : "success"}
                        dot={false}
                      >
                        {formatLabel(incident.status.toLowerCase())}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(incident.startedAt)} UTC
                      {incident.resolvedAt ? ` → ${formatDateTime(incident.resolvedAt)} UTC` : " → ongoing"}
                      {" · "}overlap {formatDuration(incident.overlapMs)}
                    </p>
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
