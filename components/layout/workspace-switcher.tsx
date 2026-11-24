"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-left transition-colors hover:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none data-[popup-open]:bg-slate-800"
            aria-label="Current workspace: Acme Engineering"
          />
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-[0.7rem] font-bold text-white">
          PW
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-100">
            Acme Engineering
          </span>
          <span className="block truncate text-[0.65rem] text-slate-400">
            Demo workspace
          </span>
        </span>
        <ChevronsUpDown
          className="size-3.5 shrink-0 text-slate-500"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between">
          <span>Acme Engineering</span>
          <Check className="size-3.5 text-primary" aria-hidden="true" />
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="justify-between gap-2">
          <span>Add another workspace</span>
          <span className="text-[0.65rem] text-muted-foreground">Phase 3</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-1.5 py-1 text-[0.7rem] text-muted-foreground">
          Only one demo workspace exists in Phase 1.
        </p>
        <DropdownMenuItem disabled>
          <Plus className="size-3.5" aria-hidden="true" />
          Team invitations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
