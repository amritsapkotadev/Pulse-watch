import type { Metadata } from "next";
import Link from "next/link";

import { CollectionsManager } from "@/components/collections/collections-manager";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/collections");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function CollectionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.description}
        eyebrow="Workspace"
        actions={
          <Button render={<Link href="/requests" />} nativeButton={false} variant="outline">
            New API request
          </Button>
        }
      />
      <CollectionsManager />
    </div>
  );
}
