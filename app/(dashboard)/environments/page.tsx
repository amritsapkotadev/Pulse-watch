import type { Metadata } from "next";
import Link from "next/link";

import { EnvironmentsManager } from "@/components/environments/environments-manager";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/environments");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function EnvironmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.description}
        eyebrow="Configuration"
        actions={
          <Button render={<Link href="/requests" />} nativeButton={false} variant="outline">
            View request builder
          </Button>
        }
      />
      <EnvironmentsManager />
    </div>
  );
}
