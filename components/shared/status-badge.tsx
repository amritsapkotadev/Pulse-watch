import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  IncidentSeverity,
  IncidentStatus,
  MonitorStatus,
} from "@/lib/mock-data";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success:
    "border-success/25 bg-success/10 text-success dark:border-success/30 dark:bg-success/15",
  warning:
    "border-warning/30 bg-warning/15 text-amber-900 dark:border-warning/35 dark:bg-warning/15 dark:text-warning",
  danger:
    "border-danger/25 bg-danger/10 text-danger dark:border-danger/35 dark:bg-danger/15",
  info: "border-info/25 bg-info/10 text-info dark:border-info/35 dark:bg-info/15",
  neutral: "border-border bg-muted/60 text-muted-foreground",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export interface StatusBadgeProps {
  children: ReactNode;
  tone: StatusTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  children,
  tone,
  dot = true,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 px-2 font-medium", toneClasses[tone], className)}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotClasses[tone])}
        />
      ) : null}
      {children}
    </Badge>
  );
}

export const monitorStatusTone: Record<MonitorStatus, StatusTone> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
};

export const incidentStatusTone: Record<IncidentStatus, StatusTone> = {
  investigating: "danger",
  identified: "warning",
  monitoring: "info",
  resolved: "success",
};

export const severityTone: Record<IncidentSeverity, StatusTone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
};

export function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
