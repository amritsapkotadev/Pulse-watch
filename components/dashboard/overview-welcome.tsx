import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/monitoring/format";

interface OverviewWelcomeProps {
  generatedAt: string;
  hasData: boolean;
}

export function OverviewWelcome({ generatedAt, hasData }: OverviewWelcomeProps) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
            Live data · {formatDateTime(generatedAt)} UTC
          </span>
          <span className="inline-flex items-center rounded-md border border-success/25 bg-success/10 px-2 py-1 text-xs text-success">
            {hasData ? "Database connected" : "Awaiting first monitor"}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          PulseWatch monitoring overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Real check results and incidents from your shared monitor database.
        </p>
      </div>

      <Button
        render={<Link href="/monitors" />}
        nativeButton={false}
        className="bg-primary shadow-sm"
      >
        <Plus className="size-4" aria-hidden="true" />
        Manage Monitors
      </Button>
    </section>
  );
}
