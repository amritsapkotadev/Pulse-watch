import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { PublicOverallState, PublicServiceState } from "@/lib/monitoring/types";

type Tone = "success" | "warning" | "danger" | "neutral";

const styles: Record<Tone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function publicStateTone(state: PublicServiceState): Tone {
  if (state === "DOWN") return "danger";
  if (state === "DEGRADED" || state === "UNKNOWN") return state === "DEGRADED" ? "warning" : "neutral";
  return "success";
}

export function publicOverallTone(state: PublicOverallState): Tone {
  if (state === "OUTAGE") return "danger";
  if (state === "DEGRADED") return "warning";
  if (state === "NO_DATA") return "neutral";
  return "success";
}

export function publicStateLabel(state: PublicServiceState): string {
  switch (state) {
    case "UP":
      return "Operational";
    case "DOWN":
      return "Outage";
    case "DEGRADED":
      return "Degraded";
    default:
      return "No data";
  }
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        styles[tone],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "success"
            ? "bg-success"
            : tone === "warning"
              ? "bg-warning"
              : tone === "danger"
                ? "bg-danger"
                : "bg-muted-foreground",
        )}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
