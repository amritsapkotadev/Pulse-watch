import { Database } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AnalyticsDataNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Database className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-muted-foreground">
        Analytics are computed only from stored <code className="rounded bg-muted px-1 py-0.5">MonitorCheck</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5">Incident</code> records. No mock data is used.
      </CardContent>
    </Card>
  );
}
