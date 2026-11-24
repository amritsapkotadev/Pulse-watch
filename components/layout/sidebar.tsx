"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { cn } from "@/lib/utils";
import { navigationGroups } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";

export interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navigationGroups.map((group) => [group.label, true])),
  );

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col bg-slate-950 text-slate-100",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-5 pr-12 lg:pr-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          aria-label="PulseWatch — go to overview"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm shadow-indigo-900/40">
            <Activity className="size-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-white">
              PulseWatch
            </span>
            <span className="block truncate text-[0.65rem] text-slate-400">
              Monitor. Test. Stay Ahead.
            </span>
          </span>
        </Link>
      </div>

      <div className="px-3 pb-4">
        <WorkspaceSwitcher />
      </div>

      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        {navigationGroups.map((group) => {
          const groupId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
          const isOpen = openGroups[group.label];

          return (
            <div key={group.label} className="mb-5">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.label]: !current[group.label],
                  }))
                }
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[0.66rem] font-semibold tracking-widest text-slate-500 uppercase transition-colors hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                aria-expanded={isOpen}
                aria-controls={groupId}
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>

              <ul
                id={groupId}
                hidden={!isOpen}
                className="mt-1.5 space-y-0.5"
              >
                {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none",
                            isActive
                              ? "bg-indigo-500/15 text-white ring-1 ring-indigo-400/25"
                              : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive
                                ? "text-indigo-300"
                                : "text-slate-500 group-hover:text-slate-300",
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.title}</span>
                          {isActive ? (
                            <span
                              className="ml-auto size-1.5 rounded-full bg-indigo-400"
                              aria-hidden="true"
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3">
        <UserProfileMenu variant="sidebar" />
        <p className="px-2 pt-2 text-[0.65rem] text-slate-600">
          PulseWatch · Phase 1 preview
        </p>
      </div>
    </aside>
  );
}
