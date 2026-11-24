import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/settings");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function SettingsPage() {
  return (
    <PlaceholderPage
      item={item}
      primaryAction={{ label: "Back to overview", href: "/dashboard" }}
    />
  );
}
