"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronRight, CircleHelp, Menu, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { getPageMeta } from "@/lib/navigation";

export interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden"
        >
          <Menu className="size-4.5" />
        </Button>

        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"
          >
            {meta.breadcrumb.map((crumb, index) => (
              <span key={crumb} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="size-3" aria-hidden="true" />
                ) : null}
                <span className={index === meta.breadcrumb.length - 1 ? "text-foreground" : undefined}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
          <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {meta.title}
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <GlobalSearch />
          <NotificationsMenu />
          <HelpMenu />

          <span
            className="mx-1 hidden h-6 w-px bg-border sm:block"
            aria-hidden="true"
          />

          <Button
            render={<Link href="/requests" />}
            nativeButton={false}
            aria-label="New Request"
            className="bg-primary shadow-sm"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Request</span>
          </Button>

          <div className="hidden sm:block">
            <UserProfileMenu variant="topbar" />
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationsMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-5 text-center text-sm text-muted-foreground">
          No new notifications in this demo.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/incidents")}>
          View incidents
        </DropdownMenuItem>
        <p className="px-1.5 py-1 text-[0.7rem] text-muted-foreground">
          Alert delivery arrives with monitoring in a future phase.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HelpMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Help" />}
      >
        <CircleHelp className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Help</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
          Back to overview
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          Workspace settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between gap-2">
          <span>Help center</span>
          <span className="text-[0.65rem] text-muted-foreground">Phase 3</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
