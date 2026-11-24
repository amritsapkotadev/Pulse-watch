import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`${title} — ${description}`}
    >
      <Card className="h-full gap-0 py-0 ring-1 ring-foreground/8 transition-all group-hover:-translate-y-0.5 group-hover:ring-primary/35 group-hover:shadow-sm">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          </div>
          <ArrowUpRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              "group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary",
            )}
            aria-hidden="true"
          />
        </div>
      </Card>
    </Link>
  );
}
