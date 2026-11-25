import {
  Activity,
  AlertTriangle,
  BarChart3,
  Folder,
  Globe2,
  History,
  LayoutDashboard,
  Send,
  Settings2,
  SlidersHorizontal,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        description: "Monitor health and recent activity across configured endpoints.",
        icon: LayoutDashboard,
      },
      {
        title: "Analytics",
        href: "/analytics",
        description: "Historical uptime, latency, and reliability analytics.",
        icon: BarChart3,
      },
      {
        title: "Public Status",
        href: "/status",
        description: "Open the public, read-only status page.",
        icon: Globe2,
        external: true,
      },
    ],
  },
  {
    label: "API Tools",
    items: [
      {
        title: "API Tester",
        href: "/requests",
        description: "Build and inspect HTTP requests.",
        icon: Send,
      },
      {
        title: "Collections",
        href: "/collections",
        description: "Organize saved requests into collections.",
        icon: Folder,
      },
      {
        title: "Environments",
        href: "/environments",
        description: "Manage reusable variables for each environment.",
        icon: SlidersHorizontal,
      },
      {
        title: "History",
        href: "/history",
        description: "Review recent stored monitoring checks.",
        icon: History,
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        title: "Monitors",
        href: "/monitors",
        description: "Create and configure availability checks.",
        icon: Activity,
      },
      {
        title: "Incidents",
        href: "/incidents",
        description: "Review detected incidents and their resolution state.",
        icon: AlertTriangle,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Settings",
        href: "/settings",
        description: "Administrator account, monitoring configuration, and public links.",
        icon: Settings2,
      },
    ],
  },
];

export const navigationItems: NavItem[] = navigationGroups.flatMap((group) => group.items);

export const navItemsByHref: Record<string, NavItem> = Object.fromEntries(
  navigationItems.map((item) => [item.href, item]),
);

export function getNavItem(href: string): NavItem {
  return navItemsByHref[href];
}

export interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const quickActions: QuickAction[] = [
  {
    title: "Create Monitor",
    description: "Watch a new endpoint",
    href: "/monitors",
    icon: Activity,
  },
  {
    title: "New API Request",
    description: "Open the request builder",
    href: "/requests",
    icon: Send,
  },
  {
    title: "View Analytics",
    description: "Explore performance trends",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Public Status",
    description: "Open the public status page",
    href: "/status",
    icon: ArrowUpRight,
  },
];

export interface PageMeta {
  title: string;
  description: string;
  breadcrumb: string[];
}

export const pageMeta: Record<string, PageMeta> = Object.fromEntries(
  navigationItems.map((item) => [
    item.href,
    {
      title: item.title,
      description: item.description,
      breadcrumb: [
        navigationGroups.find((group) => group.items.includes(item))?.label ?? "PulseWatch",
        item.title,
      ],
    },
  ]),
);

pageMeta["/analytics/"] = {
  title: "Monitor analytics",
  description: "Historical analytics for an individual public API monitor.",
  breadcrumb: ["Overview", "Analytics", "Monitor"],
};

export function getPageMeta(pathname: string): PageMeta {
  if (pathname.startsWith("/analytics/")) return pageMeta["/analytics/"];
  return (
    pageMeta[pathname] ?? {
      title: "PulseWatch",
      description: "API monitoring and uptime analytics.",
      breadcrumb: ["PulseWatch"],
    }
  );
}
