import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg gap-4">
        <CardHeader className="px-6 pt-6">
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Compass className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-lg">Page not found</CardTitle>
          <CardDescription>
            We couldn&apos;t find that PulseWatch page. Head back to the
            overview to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Button render={<Link href="/dashboard" />} nativeButton={false}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
