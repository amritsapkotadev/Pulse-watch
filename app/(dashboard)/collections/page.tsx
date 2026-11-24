import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/collections");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function CollectionsPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "New API Request", href: "/requests" }}
      secondaryAction={{ label: "View overview", href: "/dashboard" }}
    />
  );
}
