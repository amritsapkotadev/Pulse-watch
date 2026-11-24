import type { Metadata } from "next";
import Link from "next/link";

import { RequestBuilder } from "@/components/requests/request-builder";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/requests");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function RequestsPage() {
  const executionEnabled = process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.description}
        eyebrow="API workspace"
        actions={
          <Button render={<Link href="/collections" />} nativeButton={false} variant="outline">
            View collections
          </Button>
        }
      />
      <RequestBuilder executionEnabled={executionEnabled} />
    </div>
  );
}
