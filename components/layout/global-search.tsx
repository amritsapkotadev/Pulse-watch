"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigationItems, type NavItem } from "@/lib/navigation";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const id = useId();

  const results = useMemo<NavItem[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return navigationItems
      .filter((item) =>
        `${item.title} ${item.description}`.toLowerCase().includes(normalized),
      )
      .slice(0, 6);
  }, [query]);

  const handleSelect = () => {
    setQuery("");
    setOpen(false);
    setMobileOpen(false);
  };

  const field = (inputId: string) => (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="search"
        role="combobox"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setMobileOpen(false);
          }
        }}
        placeholder="Search pages..."
        aria-label="Search pages"
        aria-expanded={open && query.length > 0}
        aria-controls={`${inputId}-results`}
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-input bg-muted/35 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
      />

      {open && query.trim().length > 0 ? (
        <div
          id={`${inputId}-results`}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">
              No pages match “{query.trim()}”.
            </p>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleSelect}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <div className={cn("hidden w-full max-w-xs md:block")}>
        {field(`${id}-desktop`)}
      </div>

      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileOpen ? "Close search" : "Open search"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((current) => !current)}
        >
          <Search className="size-4" />
        </Button>
        {mobileOpen ? (
          <div className="absolute top-full right-4 left-4 z-50 mt-2 rounded-xl border bg-background p-2 shadow-lg">
            {field(`${id}-mobile`)}
          </div>
        ) : null}
      </div>
    </>
  );
}
