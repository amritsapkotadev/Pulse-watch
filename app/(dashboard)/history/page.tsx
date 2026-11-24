import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/history");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function HistoryPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "View analytics", href: "/analytics" }}
      secondaryAction={{ label: "View overview", href: "/dashboard" }}
    />
  );
}
