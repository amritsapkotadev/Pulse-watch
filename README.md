# PulseWatch

**Monitor. Test. Stay Ahead.**

PulseWatch is a unified workspace for testing APIs, monitoring endpoint availability, tracking performance, and identifying failures. This repository contains **Phase 1: Project Foundation** plus **Phase 2: API Request Builder**.

## Included

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, Recharts, and ESLint
- Persistent dark sidebar, responsive mobile drawer, top navigation, workspace selector, search, notifications, help, and profile menus
- Overview dashboard at `/dashboard` with clearly labeled mock data
- Functional request builder at `/requests` with:
  - `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `HEAD`
  - Query params, headers, Bearer/Basic/API key authorization, and JSON/raw bodies
  - Response status, status text, timing, size, body, headers, and Pretty/Raw/Headers views
  - JSON formatting and syntax highlighting
  - Duplicate-submit prevention, validation messages, loading/error/empty states
- Real HTTP execution through `POST /api/requests/execute`
- Dev-only execution with SSRF, redirect, timeout, size, rate, and concurrency protections
- Placeholder pages for all other navigation destinations

Save requests, collections, history, environments, authentication, monitors, alerts, database persistence, and third-party integrations are not included yet.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`; the request builder is at `/requests`.

## Request execution

Execution is only enabled when `NODE_ENV !== "production"`. In production, `/api/requests/execute` returns `403 disabled`.

Example request:

```bash
curl -X POST http://localhost:3000/api/requests/execute \
  -H 'content-type: application/json' \
  --data '{
    "method": "GET",
    "url": "https://httpbin.org/get",
    "params": [{ "id": "p1", "key": "foo", "value": "bar", "enabled": true }],
    "headers": [],
    "auth": { "type": "none" },
    "body": { "type": "none" }
  }'
```

Useful public test endpoints include:

- `https://httpbin.org/get`
- `https://httpbin.org/post`
- `https://jsonplaceholder.typicode.com/posts/1`

Only test APIs you own or have explicit permission to test.

## Security limitations

This is a development tool, not a general-purpose proxy.

Current protections:

- Only `http:` and `https:` URLs are accepted
- Localhost, private, loopback, link-local, multicast, reserved, cloud metadata, and `.local`/`.internal` targets are blocked
- DNS results are validated before connection and pinned per request to reduce DNS rebinding risk
- Redirects are handled manually and every redirect target is revalidated
- Credentials embedded in URLs are rejected
- Request payloads, response bodies, timeouts, concurrency, and rate limits are capped
- Authorization values are not logged
- Production execution is disabled

Before exposing execution outside local development:

1. Add real authentication and per-user authorization.
2. Run the executor on an isolated network with no route to internal services or cloud metadata.
3. Replace in-memory rate/concurrency limits with shared, per-user limits.
4. Add audit logging that redacts credentials and sensitive response headers.
5. Re-run a dedicated SSRF, DNS rebinding, redirect, and resource-exhaustion security review.

With Cache Components enabled, Next.js uses the default Node.js runtime and rejects an explicit `runtime = "nodejs"` export, so the API route intentionally does not export a runtime value.

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
  (dashboard)/              Shared App Router shell and all dashboard routes
  api/requests/execute/     Request execution API route
  layout.tsx                Root layout and metadata
  page.tsx                  Redirects / to /dashboard
  not-found.tsx             404 state
components/
  layout/                   Sidebar, topbar, search, menus, app shell
  dashboard/                Overview dashboard sections
  requests/                 Request builder, editors, and response viewer
  shared/                   Reusable presentational components
  ui/                       shadcn/ui components
lib/
  navigation.ts             Nav groups, page metadata, quick actions
  mock-data.ts              Phase 1 demo data and types
  requests/                 Request schema, defaults, URL builder, client helper
  server/                   Server-only HTTP executor and SSRF protections
  utils.ts                  Shared class-name utility
```

All dashboard numbers are illustrative mock data, not live monitoring results.
