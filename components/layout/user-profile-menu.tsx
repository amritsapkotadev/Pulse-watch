"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings2, History } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface UserProfileMenuProps {
  variant?: "sidebar" | "topbar";
}

export function UserProfileMenu({ variant = "sidebar" }: UserProfileMenuProps) {
  const router = useRouter();
  const isSidebar = variant === "sidebar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none",
              isSidebar
                ? "w-full px-2 py-2 text-left hover:bg-slate-800/70"
                : "p-0.5 hover:bg-muted",
            )}
            aria-label="Open profile menu"
          />
        }
      >
        <Avatar className="size-8 border border-slate-700 bg-slate-800">
          <AvatarFallback className="bg-indigo-500/20 text-xs font-semibold text-indigo-200">
            AM
          </AvatarFallback>
        </Avatar>
        {isSidebar ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-100">
                Alex Morgan
              </span>
              <span className="block truncate text-[0.65rem] text-slate-400">
                Demo user
              </span>
            </span>
            <ChevronDown
              className="size-3.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="py-2">
            <span className="block text-sm font-medium text-foreground">
              Alex Morgan
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              alex@pulsewatch.demo
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings2 className="size-4" aria-hidden="true" />
          Workspace settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/history")}>
          <History className="size-4" aria-hidden="true" />
          Request history
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </span>
          <span className="text-[0.65rem] text-muted-foreground">Phase 2</span>
        </DropdownMenuItem>
        <p className="px-1.5 py-1 text-[0.7rem] text-muted-foreground">
          Authentication is not part of Phase 1.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
