"use client";

import {
  CartesianGrid,
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
import type { DashboardData } from "@/lib/monitoring/types";

interface ResponseTimeChartProps {
  data: DashboardData["history"];
  averageResponseTimeMs: number;
}

export function ResponseTimeChart({ data, averageResponseTimeMs }: ResponseTimeChartProps) {
  const maxValue = Math.max(200, ...data.map((point) => point.responseTime));
  const ceiling = Math.ceil(maxValue / 100) * 100;
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round((ceiling / 4) * index));

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Response Time</CardTitle>
          <CardDescription>
            Average response time from real checks over the last 24 hours
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No check results yet. Run a check to see response times.
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  domain={[0, ceiling]}
                  ticks={ticks}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number | string) => `${value} ms`}
                  width={58}
                />
                <Tooltip
                  cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    boxShadow: "0 10px 30px -12px rgb(15 23 42 / 0.3)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  labelFormatter={(label) => `Time: ${label}`}
                  formatter={(value) => [`${value} ms`, "Response time"]}
                />
                <ReferenceLine
                  y={averageResponseTimeMs}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="5 4"
                  label={{
                    value: `Avg ${averageResponseTimeMs} ms`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="var(--chart-1)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "var(--chart-1)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
