"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsBucketDto, AnalyticsMonitorSummaryDto } from "@/lib/monitoring/types";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 10px 30px -12px rgb(15 23 42 / 0.3)",
  fontSize: 12,
};

function ChartEmpty({ message, height = 260 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}

export function UptimeTrendChart({ data }: { data: AnalyticsBucketDto[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">Uptime trend</CardTitle>
        <CardDescription>
          Historical uptime percentage per UTC bucket, with failed checks shown as bars.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {data.length === 0 ? (
          <ChartEmpty message="No check results in this range. Uptime appears as 0% until checks run." />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  yAxisId="uptime"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number | string) => `${value}%`}
                  width={52}
                />
                <YAxis
                  yAxisId="failures"
                  orientation="right"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  width={28}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  labelFormatter={(label) => `Bucket: ${label}`}
                  formatter={(value, name) => [
                    name === "Uptime" ? `${value}%` : `${value} checks`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="failures"
                  dataKey="failedChecks"
                  name="Failed checks"
                  fill="var(--danger)"
                  fillOpacity={0.25}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="uptime"
                  type="monotone"
                  dataKey="uptimePercentage"
                  name="Uptime"
                  stroke="var(--success)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "var(--success)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResponseTimeTrendChart({ data }: { data: AnalyticsBucketDto[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">Response time trend</CardTitle>
        <CardDescription>
          Average, minimum, and maximum response times from successful checks only.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {data.every((point) => point.averageResponseTimeMs === null) ? (
          <ChartEmpty message="No successful checks with response times in this range." />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number | string) => `${value} ms`}
                  width={62}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  labelFormatter={(label) => `Bucket: ${label}`}
                  formatter={(value, name) => [`${value} ms`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="averageResponseTimeMs"
                  name="Average"
                  stroke="var(--chart-1)"
                  strokeWidth={2.25}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, strokeWidth: 2, fill: "var(--chart-1)" }}
                />
                <Line
                  type="monotone"
                  dataKey="minResponseTimeMs"
                  name="Minimum"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="maxResponseTimeMs"
                  name="Maximum"
                  stroke="var(--chart-3)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MonitorComparisonChart({
  monitors,
}: {
  monitors: AnalyticsMonitorSummaryDto[];
}) {
  const data = monitors
    .filter((monitor) => monitor.averageResponseTimeMs !== null)
    .map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      averageResponseTimeMs: monitor.averageResponseTimeMs,
    }));
  const height = Math.max(240, data.length * 44 + 40);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">Response time by monitor</CardTitle>
        <CardDescription>
          Compare average response times across public API endpoints in this range.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {data.length === 0 ? (
          <ChartEmpty message="No successful checks with response times to compare." />
        ) : (
          <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number | string) => `${value} ms`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
                  width={130}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(value) => [`${value} ms`, "Average response time"]}
                />
                <ReferenceLine x={0} stroke="var(--border)" />
                <Bar
                  dataKey="averageResponseTimeMs"
                  name="Average response time"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
