import Link from "next/link";
import { CheckCircle2, Construction, Info } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { MockDataNote } from "@/components/shared/mock-data-note";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NavItem } from "@/lib/navigation";

export interface PlaceholderAction {
  label: string;
  href: string;
}

export interface PlaceholderPageProps {
  item: NavItem;
  primaryAction?: PlaceholderAction;
  secondaryAction?: PlaceholderAction;
}

function ActionLink({
  action,
  variant,
}: {
  action: PlaceholderAction;
  variant: "default" | "outline";
}) {
  return (
    <Button
      variant={variant}
      render={<Link href={action.href} />}
      nativeButton={false}
    >
      {action.label}
    </Button>
  );
}

export function PlaceholderPage({
  item,
  primaryAction = { label: "View overview", href: "/dashboard" },
  secondaryAction,
}: PlaceholderPageProps) {
  const Icon = item.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.description}
        eyebrow={`${item.phase} preview`}
        actions={<MockDataNote />}
      />

      <Card className="gap-0 py-0">
        <CardContent className="px-5 py-3">
          <EmptyState
            icon={Construction}
            title={`${item.title} is planned for ${item.phase}`}
            description="This screen is part of the Phase 1 UI foundation. No requests, checks, or live data are connected yet."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ActionLink action={primaryAction} variant="default" />
                {secondaryAction ? (
                  <ActionLink action={secondaryAction} variant="outline" />
                ) : null}
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" aria-hidden="true" />
            What&apos;s planned
          </CardTitle>
          <CardDescription>
            These capabilities will be implemented in a future phase. Nothing
            on this page performs live API or monitoring work today.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="grid gap-3 sm:grid-cols-2">
            {item.plannedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Phase 1 is intentionally limited to the shared layout, navigation,
            and a mock-data overview dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
