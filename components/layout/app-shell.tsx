"use client";

import { useState, type ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export interface AppShellProps {
  children: ReactNode;
  adminEmail?: string;
  csrfToken?: string;
}

export function AppShell({ children, adminEmail, csrfToken }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <Sidebar
        className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:flex"
        adminEmail={adminEmail}
        csrfToken={csrfToken}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          adminEmail={adminEmail}
          csrfToken={csrfToken}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        adminEmail={adminEmail}
        csrfToken={csrfToken}
      />
    </div>
  );
}
