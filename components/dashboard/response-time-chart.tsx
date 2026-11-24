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
import { MockDataNote } from "@/components/shared/mock-data-note";
import { dashboardStats, responseTimeData } from "@/lib/mock-data";

export function ResponseTimeChart() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Response Time</CardTitle>
          <CardDescription>
            Average response time over the last 24 hours · mock data
          </CardDescription>
        </div>
        <MockDataNote />
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={responseTimeData}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                interval={3}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis
                domain={[0, 280]}
                ticks={[0, 70, 140, 210, 280]}
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
                y={dashboardStats.averageResponseTimeMs}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 4"
                label={{
                  value: `Avg ${dashboardStats.averageResponseTimeMs} ms`,
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
      </CardContent>
    </Card>
  );
}
