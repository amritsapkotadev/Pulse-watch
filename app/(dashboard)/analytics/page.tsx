import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/analytics");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "View overview", href: "/dashboard" }}
      secondaryAction={{ label: "View monitors", href: "/monitors" }}
    />
  );
}
