import Link from "next/link";

import { AlertTriangle } from "lucide-react";

import { PublicHeader } from "@/components/shared/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PublicDataNotice({ description }: { description: string }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 text-center">
        <Card className="w-full border-border shadow-sm">
          <CardContent className="space-y-4 px-6 py-10">
            <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight">Monitoring data unavailable</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Button render={<Link href="/status" />} nativeButton={false} variant="outline">
              View status page
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
