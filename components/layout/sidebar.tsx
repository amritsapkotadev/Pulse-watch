"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowUpRight } from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { navigationGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  adminEmail?: string;
  csrfToken?: string;
}

function isItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href === "/analytics" && pathname.startsWith("/analytics/");
}

export function Sidebar({ className, onNavigate, adminEmail, csrfToken }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-border bg-white text-foreground",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="PulseWatch — go to overview"
        >
          <Brand href="/dashboard" />
        </Link>
      </div>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.title}</span>
                      {item.external ? (
                        <ArrowUpRight className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <UserProfileMenu
          variant="sidebar"
          adminEmail={adminEmail}
          csrfToken={csrfToken}
        />
      </div>
    </aside>
  );
}
