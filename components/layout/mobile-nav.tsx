"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";

export interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[18rem] max-w-[88vw] gap-0 border-r border-slate-800 bg-slate-950 p-0 text-slate-100"
      >
        <SheetTitle className="sr-only">Main navigation</SheetTitle>
        <Sidebar onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
