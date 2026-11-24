"use client";

import type { AnalyticsRange } from "@/lib/monitoring/types";

const options: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AnalyticsRangeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden sm:inline">Range</span>
      <select
        aria-label="Analytics time range"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AnalyticsRange)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
