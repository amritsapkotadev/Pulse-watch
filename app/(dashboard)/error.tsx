"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg gap-4">
        <CardHeader className="px-6 pt-6">
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-lg">Something went wrong</CardTitle>
          <CardDescription>
            The dashboard could not be rendered. This is a Phase 1 placeholder
            error state; no monitoring data was affected.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
