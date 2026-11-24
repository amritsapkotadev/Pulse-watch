"use client";

import { cn } from "cn";

import { HTTP_METHODS, type HttpMethod } from "@/lib/requests/schema";

const methodStyles: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  POST: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PATCH: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  DELETE: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  HEAD: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

interface MethodSelectorProps {
  value: HttpMethod;
  onChange: (method: HttpMethod) => void;
  disabled?: boolean;
}

export function MethodSelector({ value, onChange, disabled }: MethodSelectorProps) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label="HTTP method"
        className={cn(
          "h-9 w-[112px] cursor-pointer appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          methodStyles[value],
        )}
        value={value}
        onChange={(event) => onChange(event.target.value as HttpMethod)}
        disabled={disabled}
      >
        {HTTP_METHODS.map((method) => (
          <option key={method} value={method} className="bg-card text-foreground">
            {method}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-2.5 size-1.5 -translate-y-1/2 rotate-45 border-r border-b border-current opacity-60" />
    </div>
  );
}
