# PulseWatch

**Monitor. Test. Stay Ahead.**

PulseWatch is a unified workspace for testing APIs, monitoring endpoint availability, tracking performance, and identifying failures. This repository currently contains **Phase 1: Project Foundation** only.

## Phase 1 scope

Included:

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, Recharts, and ESLint
- Persistent dark sidebar, responsive mobile drawer, top navigation, workspace selector, search, notifications, help, and profile menus
- Overview dashboard at `/dashboard` with clearly labeled mock data
- Placeholder pages for all navigation destinations
- Shared, reusable layout, dashboard, and UI components
- Loading, error, and not-found states

Not included yet: API testing, monitoring engines, database, authentication, email alerts, background jobs, or third-party integrations.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

## Project structure

```text
app/
  (dashboard)/          Shared App Router shell and all dashboard routes
  layout.tsx            Root layout and metadata
  page.tsx              Redirects / to /dashboard
  not-found.tsx         404 state
components/
  layout/               Sidebar, topbar, search, menus, app shell
  dashboard/            Overview dashboard sections
  shared/               Reusable presentational components
  ui/                   shadcn/ui components
lib/
  navigation.ts         Nav groups, page metadata, quick actions
  mock-data.ts          Phase 1 demo data and types
  utils.ts              Shared class-name utility
```

All dashboard numbers and API records are illustrative mock data, not live monitoring results.
