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
  Upload,
  PlusCircle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  phase: "Phase 2" | "Phase 3";
  plannedFeatures: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Overview",
        href: "/dashboard",
        description: "Workspace health and recent activity at a glance.",
        icon: LayoutDashboard,
        phase: "Phase 2",
        plannedFeatures: [
          "Live data sourced from your monitors",
          "Customizable dashboard widgets",
          "Workspace-wide health summaries",
        ],
      },
      {
        title: "API Requests",
        href: "/requests",
        description: "Build and send HTTP requests from a shared workspace.",
        icon: Send,
        phase: "Phase 2",
        plannedFeatures: [
          "GET, POST, PUT, PATCH, and DELETE request builder",
          "Headers, query parameters, auth, and request bodies",
          "Response viewer with status, timing, and body inspection",
          "Automated assertions on responses",
        ],
      },
      {
        title: "Collections",
        href: "/collections",
        description: "Organize requests into reusable, shareable collections.",
        icon: Folder,
        phase: "Phase 2",
        plannedFeatures: [
          "Nested folders and saved requests",
          "Postman collection import",
          "Collection-level variables and scripts",
        ],
      },
      {
        title: "Request History",
        href: "/history",
        description: "Review previously sent requests and their responses.",
        icon: History,
        phase: "Phase 2",
        plannedFeatures: [
          "Searchable request timeline",
          "Response snapshots and timing details",
          "Re-run a previous request",
        ],
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        title: "Monitors",
        href: "/monitors",
        description: "Configure scheduled endpoint availability checks.",
        icon: Activity,
        phase: "Phase 2",
        plannedFeatures: [
          "Scheduled endpoint checks",
          "Uptime calculations and response-time tracking",
          "Per-monitor alert settings",
        ],
      },
      {
        title: "Incidents",
        href: "/incidents",
        description: "Track failures from detection through resolution.",
        icon: AlertTriangle,
        phase: "Phase 2",
        plannedFeatures: [
          "Automatic incident detection",
          "Severity and status workflows",
          "Incident timelines and resolution notes",
        ],
      },
      {
        title: "Analytics",
        href: "/analytics",
        description: "Explore uptime, latency, and reliability trends.",
        icon: BarChart3,
        phase: "Phase 3",
        plannedFeatures: [
          "Historical uptime reporting",
          "Response-time percentiles",
          "Failure rate breakdowns by endpoint",
        ],
      },
      {
        title: "Status Page",
        href: "/status",
        description: "Open the public, real-time view of service health.",
        icon: Globe2,
        phase: "Phase 3",
        plannedFeatures: [
          "Public status view from stored checks",
          "Component-level status and incident updates",
          "Custom branding and domain settings",
        ],
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        title: "Environments",
        href: "/environments",
        description: "Manage variables and endpoints for each stage.",
        icon: SlidersHorizontal,
        phase: "Phase 2",
        plannedFeatures: [
          "Development, staging, and production variables",
          "Scoped secrets with masked values",
          "Environment switching inside the request builder",
        ],
      },
      {
        title: "Settings",
        href: "/settings",
        description: "Configure workspace preferences and integrations.",
        icon: Settings2,
        phase: "Phase 3",
        plannedFeatures: [
          "Workspace profile and member roles",
          "Email notification preferences",
          "Neon, Prisma, and Resend integration setup",
        ],
      },
    ],
  },
];

export const navigationItems: NavItem[] = navigationGroups.flatMap(
  (group) => group.items,
);

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
    icon: PlusCircle,
  },
  {
    title: "New API Request",
    description: "Open the request builder",
    href: "/requests",
    icon: Send,
  },
  {
    title: "Import Collection",
    description: "Bring in a Postman file",
    href: "/collections",
    icon: Upload,
  },
  {
    title: "View Analytics",
    description: "Explore performance trends",
    href: "/analytics",
    icon: ArrowUpRight,
  },
];

export interface PageMeta {
  title: string;
  description: string;
  breadcrumb: string[];
}

export const pageMeta: Record<string, PageMeta> = {
  "/dashboard": {
    title: "Overview",
    description: "Workspace health and recent activity at a glance.",
    breadcrumb: ["Workspace", "Overview"],
  },
  ...Object.fromEntries(
    navigationItems.map((item) => [
      item.href,
      {
        title: item.title,
        description: item.description,
        breadcrumb: [
          navigationGroups.find((group) => group.items.includes(item))?.label ??
            "Workspace",
          item.title,
        ],
      },
    ]),
  ),
};

export function getPageMeta(pathname: string): PageMeta {
  return (
    pageMeta[pathname] ?? {
      title: "PulseWatch",
      description: "Monitor. Test. Stay Ahead.",
      breadcrumb: ["Workspace", "PulseWatch"],
    }
  );
}
