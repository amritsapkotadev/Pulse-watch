import type { Metadata } from "next";
import { connection } from "next/server";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { formatDateTime } from "@/lib/monitoring/format";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/history");

export const metadata: Metadata = {
  title: item.title,
  description: "Recent stored monitoring checks.",
};

export default async function HistoryPage() {
  await connection();

  const checks = isDatabaseConfigured()
    ? await prisma.monitorCheck.findMany({
        take: 100,
        orderBy: { checkedAt: "desc" },
        select: {
          id: true,
          status: true,
          statusCode: true,
          responseTime: true,
          checkedAt: true,
          monitor: { select: { name: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description="Most recent stored check results across all configured monitors."
      />
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-base">Recent checks</CardTitle>
          <CardDescription>
            {isDatabaseConfigured()
              ? "Newest first, limited to the last 100 stored results."
              : "Configure the database to load stored check history."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Monitor</TableHead>
                  <TableHead className="px-4">Result</TableHead>
                  <TableHead className="px-4 text-right">Status code</TableHead>
                  <TableHead className="px-4 text-right">Response time</TableHead>
                  <TableHead className="px-4 text-right">Checked at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No check results are stored yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  checks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="px-4 font-medium">{check.monitor.name}</TableCell>
                      <TableCell className="px-4">
                        <span
                          className={
                            check.status === "UP"
                              ? "text-success"
                              : check.status === "DOWN"
                                ? "text-danger"
                                : "text-muted-foreground"
                          }
                        >
                          {check.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 text-right tabular-nums">
                        {check.statusCode ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 text-right tabular-nums">
                        {check.responseTime > 0 ? `${check.responseTime} ms` : "—"}
                      </TableCell>
                      <TableCell className="px-4 text-right text-xs text-muted-foreground">
                        {formatDateTime(check.checkedAt.toISOString())} UTC
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
