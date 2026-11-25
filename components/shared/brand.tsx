import Link from "next/link";

import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="PulseWatch home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
        <Activity className="size-4" aria-hidden="true" />
      </span>
      {compact ? null : (
        <span className="text-base font-semibold tracking-tight text-foreground">PulseWatch</span>
      )}
    </Link>
  );
}

export function BrandWithTagline({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Brand />
      <p className="text-xs tracking-wide text-muted-foreground uppercase">API monitoring</p>
    </div>
  );
}
