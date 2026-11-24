import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MockDataNote } from "@/components/shared/mock-data-note";

export function OverviewWelcome() {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
            Demo date · Tuesday, 24 November 2026
          </span>
          <MockDataNote />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          Good evening, welcome to PulseWatch
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your APIs today.
        </p>
      </div>

      <Button
        render={<Link href="/monitors" />}
        nativeButton={false}
        className="bg-primary shadow-sm"
      >
        <Plus className="size-4" aria-hidden="true" />
        Create Monitor
      </Button>
    </section>
  );
}
