"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";

export interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminEmail?: string;
  csrfToken?: string;
}

export function MobileNav({ open, onOpenChange, adminEmail, csrfToken }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[18rem] max-w-[88vw] gap-0 border-r border-border bg-white p-0">
        <SheetTitle className="sr-only">Main navigation</SheetTitle>
        <Sidebar
          onNavigate={() => onOpenChange(false)}
          adminEmail={adminEmail}
          csrfToken={csrfToken}
        />
      </SheetContent>
    </Sheet>
  );
}
