import type { Metadata } from "next";

import { MonitorManager } from "@/components/monitors/monitor-manager";
import { getNavItem } from "@/lib/navigation";

const item = getNavItem("/monitors");

export const metadata: Metadata = {
  title: item.title,
  description: item.description,
};

export default function MonitorsPage() {
  return <MonitorManager />;
}
