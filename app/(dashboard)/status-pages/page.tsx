import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/status-pages");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function StatusPagesPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "View monitors", href: "/monitors" }}
      secondaryAction={{ label: "View overview", href: "/dashboard" }}
    />
  );
}
