# PulseWatch

**Monitor. Test. Stay Ahead.**

PulseWatch is a unified workspace for testing APIs, monitoring endpoint availability, tracking performance, and identifying failures. This repository contains the project foundation, API Request Builder, Collections & Environments, and a Neon/Prisma-backed monitoring architecture.

## Included

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, Recharts, and ESLint
- Persistent dark sidebar, responsive mobile drawer, top navigation, workspace selector, search, notifications, help, and profile menus
- Real database-backed monitoring dashboard at `/dashboard`; no mock monitoring results are used
- Public read-only APIs for monitor overview, monitors, incidents, and per-monitor history
- Single-tenant admin panel at `/monitors` with hashed-password login, HTTP-only session cookies, CSRF/origin checks, and login rate limiting
- Monitor create/edit/delete, server-side manual checks, scheduled due-check execution, and active incident tracking
- Neon PostgreSQL + Prisma schema with monitors, checks, incidents, leases, admin users, collections, saved requests, environments, and workspace state
- Server-side SSRF validation, DNS pinning, redirect revalidation, sanitized failure messages, and bounded response reading reused from the request executor
- DB lease to prevent overlapping checks, configurable failure threshold, incident creation after threshold, and automatic resolution on recovery
- Pagination for public monitors/incidents and admin check history
- Migration API/UI to import Phase 3 localStorage collections, saved requests, environments, and active environment into the shared database
- Functional request builder at `/requests` with:
  - `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `HEAD`
  - Query params, headers, Bearer/Basic/API key authorization, and JSON/raw bodies
  - Response status, status text, timing, size, body, headers, and Pretty/Raw/Headers views
  - JSON formatting and syntax highlighting
  - Duplicate-submit prevention, validation messages, loading/error/empty states
- Real HTTP execution through `POST /api/requests/execute`
- Dev-only execution with SSRF, redirect, timeout, size, rate, and concurrency protections

This is a single-tenant architecture: one shared monitor set, one shared workspace config, one database, one monitoring engine, one admin panel, and a public read-only dashboard. Public visitor management, user registration, multi-tenancy, billing, and team roles are intentionally not included.

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env` and set every required value:

```text
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
```

- `DATABASE_URL`: pooled Neon PostgreSQL connection string used by the runtime Prisma client.
- `DIRECT_URL`: direct Neon PostgreSQL connection string used by Prisma CLI/migrations.
- `AUTH_SECRET`: session signing secret; must be at least 32 characters.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: first administrator credentials; password must be at least 12 characters.
- `CRON_SECRET`: bearer secret for the cron endpoint; must be at least 16 characters.
- `NEXT_PUBLIC_APP_URL`: public origin used for same-origin checks.
- `RESEND_API_KEY`: reserved for future notification delivery; currently no email is sent.

Generate the Prisma client and apply the reviewed initial migration:

```bash
npm run prisma:generate
npm run db:migrate
```

Create the first admin account:

```bash
npm run admin:create
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`, the admin panel is at `/monitors`, and the request builder is at `/requests`.

The generated Prisma client is written to `generated/prisma` and is gitignored. Run `npm run prisma:generate` after cloning, after changing `prisma/schema.prisma`, and before builds/deploys.

## Monitoring architecture

### Data model

`prisma/schema.prisma` defines:

- `Monitor`: shared monitor config, current status, last check metadata, failure streak, next scheduled check, and visibility flags.
- `MonitorCheck`: immutable check history with status, status code, response time, response size, checked time, and sanitized error message.
- `Incident`: active/resolved incident with severity, start/last-seen times, occurrence count, and resolution state.
- `MonitorLease`: one row per monitor used to prevent overlapping checks.
- `AdminUser`: email plus bcrypt password hash.
- `Collection`, `SavedRequest`, `Environment`, `EnvironmentVariable`, and `WorkspaceState`: shared Phase 3 workspace data.

### Check flow

1. The scheduler (or manual admin action) selects due active monitors.
2. An atomic PostgreSQL upsert acquires a lease for the monitor.
3. The URL is parsed and validated against public protocols, blocked hostnames, embedded credentials, and private/reserved/metadata IP ranges.
4. The HTTP request is executed with DNS pinning, redirect revalidation, configurable timeout, size limits, and no localStorage/browser involvement.
5. A `MonitorCheck` row is inserted, monitor status fields are updated, and an incident is opened after the failure threshold or resolved after a successful recovery.
6. The lease is released and `nextCheckAt` is scheduled from the monitor interval.

### API routes

Public read-only:

- `GET /api/public/overview`
- `GET /api/public/monitors?page=1&pageSize=25`
- `GET /api/public/incidents?page=1&pageSize=25`
- `GET /api/public/monitors/:id/history?range=24h|7d|30d`

Admin-only:

- `POST /api/admin/login`
- `GET /api/admin/session`
- `DELETE /api/admin/session`
- `GET|POST /api/admin/monitors`
- `GET|PATCH|DELETE /api/admin/monitors/:id`
- `POST /api/admin/monitors/:id/check`
- `GET /api/admin/monitors/:id/checks?page=1&pageSize=25`
- `GET|PUT /api/admin/workspace`

Cron:

- `GET|POST /api/cron/monitor` with `Authorization: Bearer $CRON_SECRET` or `?secret=$CRON_SECRET`

All API responses use `{ ok: true, data }` or `{ ok: false, error }` and send no-store headers. Admin mutations require the `x-csrf-token` header returned by login/session and a same-origin `Origin`/`Referer` when present.

With Cache Components enabled, Next.js uses the default Node.js runtime and rejects an explicit `runtime = "nodejs"` export, so API routes intentionally do not export a runtime value.

## Request execution

Execution through `POST /api/requests/execute` is only enabled when `NODE_ENV !== "production"`. In production it returns `403 disabled`. Monitor checks use the same executor with rate limiting and the request-builder concurrency cap disabled; they are governed by the database lease and monitor-specific timeout instead.

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

Only test APIs you own or have explicit permission to test.

## Collections, environments, and database migration

`/collections` and `/environments` continue to use versioned localStorage through `pulsewatch.workspace.v1`. Open a saved request from `/collections` to restore its full configuration in the request builder. The builder can save new requests, update an existing saved request, or save a copy into any collection or folder.

Create an environment at `/environments`, add variables such as `BASE_URL` or `API_TOKEN`, and select it as active. Variables are resolved before a request is validated and sent. Missing variables are reported with the variable name and request location; nothing is sent in that case.

Postman Collection v2.1 JSON import supports the common subset: nested folders, raw/object URLs, query params, headers, raw and urlencoded bodies, and bearer/basic/API key auth. Unsupported fields are reported after import. Imported requests are never executed automatically, and imported collection variables become a new environment without being activated.

After signing in at `/monitors`, use **Import local workspace** to move the current browser workspace into the database, or **Load database workspace here** to restore the shared database workspace into the browser. The migration reuses the existing schema/version validation and decodes `obf1:` localStorage values before storing them in Neon.

## Security limitations

This is a development/monitoring tool, not a general-purpose proxy.

Current protections:

- Only `http:` and `https:` URLs are accepted for monitor targets and request-builder executions
- Localhost, private, loopback, link-local, multicast, reserved, cloud metadata, and `.local`/`.internal` targets are blocked
- DNS results are validated before connection and pinned per request to reduce DNS rebinding risk
- Redirects are handled manually and every redirect target is revalidated
- Credentials embedded in monitor URLs are rejected
- Monitor error messages and incident descriptions are sanitized before storage/display
- Passwords are hashed with bcrypt; sessions are signed with `jose` and stored in HTTP-only, SameSite cookies; cookies are `Secure` in production
- Admin mutations require CSRF tokens and same-origin checks
- Login attempts are rate limited in memory
- Request payloads, response bodies, timeouts, concurrency, and rate limits are capped
- Authorization values are not logged

Before exposing this outside a trusted environment:

1. Run the monitoring engine on an isolated network with no route to internal services or cloud metadata.
2. Replace in-memory login rate limits with a shared store.
3. Add audit logging that redacts credentials and sensitive response headers.
4. Add real notification delivery through Resend and configure alert routing.
5. Re-run a dedicated SSRF, DNS rebinding, redirect, and resource-exhaustion security review.
6. Use a real scheduler with `CRON_SECRET`; no GitHub Actions workflow is configured yet.

LocalStorage `obf1:` encoding is obfuscation, not encryption. Database secrets are stored as plain text in Neon, so restrict database access and use a dedicated, least-privilege role.

## Verification

After setting real credentials and applying the migration:

```bash
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run admin:create
npm test
npm run lint
npm run typecheck
npm run build
```

Then verify saved real data:

1. Sign in at `/monitors`.
2. Create a monitor pointing to an external public health endpoint you are allowed to check.
3. Click **Check** and confirm the monitor shows a stored status and last-checked time.
4. Open `/dashboard` and confirm stats/charts/incidents come from stored checks.
5. Call `GET /api/public/monitors` and `GET /api/public/incidents`.
6. Inspect `Monitor`, `MonitorCheck`, `Incident`, and `MonitorLease` rows in Neon Studio with `npm run db:studio`.

No database credentials are included in this repository, and no real database connectivity should be assumed until the environment variables above are set and these verification steps pass.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run start
```

## Project structure

```text
app/
  (dashboard)/                  Shared App Router shell and dashboard routes
  api/requests/execute/         Request execution API route
  api/public/                   Public read-only monitoring APIs
  api/admin/                    Admin auth, monitor, check, and workspace APIs
  api/cron/monitor/             Scheduled check trigger
  layout.tsx                    Root layout and metadata
  page.tsx                      Redirects / to /dashboard
  not-found.tsx                 404 state
components/
  layout/                       Sidebar, topbar, search, menus, app shell
  dashboard/                    Live monitoring dashboard sections
  monitors/                     Admin login, monitor manager, workspace migration UI
  requests/                     Request builder, editors, and response viewer
  collections/                  Saved request and collection management UI
  environments/                 Environment and variable management UI
  providers/                    Versioned workspace state provider
  shared/                       Reusable presentational components
  ui/                           shadcn/ui components
lib/
  api/                          API response helpers
  auth/                         Password, session, CSRF, rate-limit, and guards
  data/                         Public and admin database access functions
  monitoring/                   Config, schemas, metrics, sanitization, SSRF, engine
  navigation.ts                 Nav groups, page metadata, quick actions
  mock-data.ts                  Phase 1 demo data and types only
  requests/                     Request schema, defaults, URL builder, client helper
  server/                       Server-only HTTP executor and SSRF protections
  storage/                      Workspace schemas, obfuscation, and localStorage adapter
  postman/                      Postman Collection v2.1 import parser
  variables/                    Variable interpolation and missing-variable reporting
  utils.ts                      Shared class-name utility
prisma/
  schema.prisma                 Prisma schema
  migrations/                   Initial PostgreSQL migration
generated/prisma/                Generated Prisma client (gitignored)
scripts/
  create-admin.ts               First administrator bootstrap script
tests/
  *.test.ts                     Monitoring metrics, sanitization, SSRF, and schema tests
```
