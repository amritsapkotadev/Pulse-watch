import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/environments");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function EnvironmentsPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "View API Requests", href: "/requests" }}
      secondaryAction={{ label: "View overview", href: "/dashboard" }}
    />
  );
}
