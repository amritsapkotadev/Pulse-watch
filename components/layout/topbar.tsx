"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight, Menu, Plus } from "lucide-react";

import { GlobalSearch } from "@/components/layout/global-search";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { Button } from "@/components/ui/button";
import { getPageMeta } from "@/lib/navigation";

export interface TopbarProps {
  onMenuClick: () => void;
  adminEmail?: string;
  csrfToken?: string;
}

export function Topbar({ onMenuClick, adminEmail, csrfToken }: TopbarProps) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden"
        >
          <Menu className="size-4.5" aria-hidden="true" />
        </Button>

        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            {meta.breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
                <span className={index === meta.breadcrumb.length - 1 ? "text-foreground" : undefined}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
          <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">{meta.title}</h2>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <Button
            render={<Link href="/requests" />}
            nativeButton={false}
            className="hidden sm:inline-flex"
          >
            <Plus className="size-4" aria-hidden="true" />
            New request
          </Button>
          <UserProfileMenu variant="topbar" adminEmail={adminEmail} csrfToken={csrfToken} />
        </div>
      </div>
    </header>
  );
}
