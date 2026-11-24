import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatChange {
  value: string;
  label: string;
  direction: "up" | "down";
}

export interface StatisticsCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "danger" | "warning";
  change?: StatChange;
}

const iconToneClasses: Record<NonNullable<StatisticsCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/20 text-amber-900 dark:bg-warning/15 dark:text-warning",
};

export function StatisticsCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  change,
}: StatisticsCardProps) {
  return (
    <Card className="gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="space-y-2">
          <CardDescription className="text-[0.7rem] font-semibold tracking-wider uppercase">
            {label}
          </CardDescription>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            iconToneClasses[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 pt-1 pb-5">
        <p className="text-xs text-muted-foreground">{description}</p>
        {change ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              change.direction === "up" ? "text-success" : "text-danger",
            )}
          >
            {change.direction === "up" ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            )}
            {change.value}
            <span className="font-normal text-muted-foreground">
              {change.label}
            </span>
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
