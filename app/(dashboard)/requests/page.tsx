import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/requests");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function RequestsPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "Monitor an endpoint", href: "/monitors" }}
      secondaryAction={{ label: "View overview", href: "/dashboard" }}
    />
  );
}
