"use client";

import { useState } from "react";
import { LogOut, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface UserProfileMenuProps {
  variant?: "sidebar" | "topbar";
  adminEmail?: string;
  csrfToken?: string;
}

function initials(email: string | undefined): string {
  if (!email) return "AD";
  const [local = ""] = email.split("@");
  return local.slice(0, 2).toUpperCase() || "AD";
}

export function UserProfileMenu({
  variant = "sidebar",
  adminEmail,
  csrfToken,
}: UserProfileMenuProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isSidebar = variant === "sidebar";

  async function handleSignOut() {
    if (!csrfToken || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      if (response.ok) {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isSidebar ? "w-full px-2 py-2 text-left hover:bg-muted" : "p-0.5 hover:bg-muted",
            )}
            aria-label="Open account menu"
          />
        }
      >
        <Avatar className="size-8 border border-border bg-white">
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
            {initials(adminEmail)}
          </AvatarFallback>
        </Avatar>
        {isSidebar ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">
              {adminEmail ?? "Administrator"}
            </span>
            <span className="block truncate text-[0.65rem] text-muted-foreground">
              Administrator
            </span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="py-2">
          <span className="block truncate text-sm font-medium text-foreground">
            {adminEmail ?? "Administrator"}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            Signed in as administrator
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings2 className="size-4" aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} disabled={!csrfToken || pending}>
          <LogOut className="size-4" aria-hidden="true" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
