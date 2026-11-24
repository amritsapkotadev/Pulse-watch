# PulseWatch

**Monitor. Test. Stay Ahead.**

PulseWatch is a unified workspace for testing APIs, monitoring endpoint availability, tracking performance, and identifying failures. This repository contains the project foundation, API Request Builder, Collections & Environments, and a Neon/Prisma-backed monitoring architecture.

## Included

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, Recharts, and ESLint
- Persistent dark sidebar, responsive mobile drawer, top navigation, workspace selector, search, notifications, help, and profile menus
- Real database-backed monitoring dashboard at `/dashboard`; no mock monitoring results are used
- Public read-only APIs for monitor overview, monitors, incidents, per-monitor history, and monitoring analytics
- Database-backed analytics at `/analytics` with range filters, uptime/failure/response-time metrics, incident analysis, monitor comparison, and per-monitor detail pages
- Public status page at `/status` with real availability history, incident updates, and 45-second refresh from stored monitoring data
- Single-tenant admin panel at `/monitors` with hashed-password login, HTTP-only session cookies, CSRF/origin checks, and login rate limiting
- Monitor create/edit/delete, server-side manual checks, Vercel Schedules automatic due-check execution with a GitHub Actions dispatch fallback, and active incident tracking
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

The generated Prisma client is written to `generated/prisma` and is gitignored. The `build` script runs `prisma generate` automatically before `next build`, so deployments do not need the generated directory committed. Run `npm run prisma:generate` after cloning and after changing `prisma/schema.prisma`.

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
- `GET /api/public/analytics/overview?range=24h|7d|30d|90d`
- `GET /api/public/analytics/uptime?range=24h|7d|30d|90d`
- `GET /api/public/analytics/response-time?range=24h|7d|30d|90d`
- `GET /api/public/analytics/incidents?range=24h|7d|30d|90d&page=1&pageSize=10`
- `GET /api/public/analytics/monitors?range=24h|7d|30d|90d&page=1&pageSize=25&sort=name|uptimePercentage|averageResponseTimeMs|totalChecks|failedChecks&order=asc|desc&search=...`
- `GET /api/public/monitors/:id/analytics?range=24h|7d|30d|90d`
- `GET /api/public/status?range=24h|7d|30d`
- `GET /api/public/status/monitors?range=24h|7d|30d`
- `GET /api/public/status/incidents?range=24h|7d|30d&page=1&pageSize=25`

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
- `POST /api/internal/run-checks` with `Authorization: Bearer $CRON_SECRET` (POST alias of the cron handler used by GitHub Actions)

All API responses use `{ ok: true, data }` or `{ ok: false, error }`. Admin/cron/request routes send no-store headers; public analytics routes use a short public cache (`s-maxage=60`, `stale-while-revalidate=300`), and public status routes use `s-maxage=30`, `stale-while-revalidate=60`. All responses keep the same JSON envelope. Admin mutations require the `x-csrf-token` header returned by login/session and a same-origin `Origin`/`Referer` when present.

With Cache Components enabled, Next.js uses the default Node.js runtime and rejects an explicit `runtime = "nodejs"` export, so API routes intentionally do not export a runtime value.

## Monitoring analytics

`/analytics` is a read-only analytics workspace built only from persisted `MonitorCheck` and `Incident` rows for active monitors with `displayPublicly = true`. It adds no tables and requires no migration. All buckets and displayed timestamps are UTC, and the page shows the latest stored monitoring result. If checks are not running, analytics remain empty or stale; no mock results are generated.

### Calculation methods

- **Current status**: `currentStatus` from the latest stored monitor row (`UP`, `DOWN`, or `UNKNOWN` when no check has ever run).
- **Historical uptime**: `successfulChecks / (successfulChecks + failedChecks)` for checks whose status is `UP` or `DOWN` inside the selected range. Other statuses, if any, are excluded from the denominator.
- **No-data uptime**: `0%` when there are no determinate checks. It is never reported as `100%`.
- **Failure rate**: `failedChecks / determinateChecks`, or `0%` with no determinate checks.
- **Response time**: calculated only from `UP` checks with a finite `responseTime > 0`. Average, minimum, and maximum are reported from those samples; missing and failed samples are never interpolated.
- **Time buckets**: `24h` uses one-hour UTC buckets; `7d`, `30d`, and `90d` use one-day UTC buckets.
- **Incidents**: incidents are included when they started before the range end and either overlap the range or are still active. MTTR is the average resolution duration for resolved incidents; longest outage is the maximum incident duration. For active incidents, displayed duration is the overlap with the selected range.
- **Most unreliable endpoints**: public monitors with stored history, ranked by failure rate and then failed-check count.

The main page separates current status, historical uptime, historical response time, endpoint comparison, and failure/incident analytics. Each monitor row links to `/analytics/:id?range=...` for a detailed trend and incident timeline. The production domain is never hardcoded; deployed links use the existing configured origin.

## Public status page

`/status` is a standalone public page outside the dashboard shell. It is built only from persisted `Monitor`, `MonitorCheck`, and `Incident` rows for active monitors with `displayPublicly = true`. It adds no tables, requires no migration, and never generates mock uptime, response time, or incident data.

The page shows an overall state, service cards, stored uptime bars, and recent incident history. The overview uses `24h` check data; the service section can switch between `24h`, `7d`, and `30d`; incident history always reads the last 30 days. Auto-refresh runs every 45 seconds only while the tab is visible, and every displayed time is UTC. The last-updated timestamp and age are always shown; data older than two minutes is explicitly marked as stale.

Status rules:

- A service is `DOWN` when its stored `currentStatus` is `DOWN`, `UNKNOWN` when it has no checks or no determinate current state, `DEGRADED` when it is currently up but has failed checks in the last 24 hours, and `Operational` otherwise.
- Overall state is `OUTAGE` if any service is down, `DEGRADED` if any service is degraded or unknown, `NO_DATA` when no public monitors exist or all are unknown, and `Operational` only when all services are operational.
- Uptime buckets use `generate_series` over UTC hour/day boundaries. Empty buckets are `No data`; all-success buckets are `Operational`; failure-only buckets are `Outage`; mixed buckets are `Degraded`.
- Uptime percentages use determinate `UP`/`DOWN` checks only. Missing data is never counted as success.
- Average response time uses successful `UP` checks with a finite positive response time.
- Incident updates are derived only from stored `startedAt`, `lastSeenAt`, `occurrenceCount`, and `resolvedAt`. Incident descriptions, monitor URLs, credentials, headers, request bodies, and sensitive error messages are never exposed.

Database access is centralized in `lib/data/status.ts`: a public monitor query, grouped status counts for `24h`/`7d`/`30d`, aggregated successful response time, last-successful-check lookup, a raw `generate_series`/`LEFT JOIN` history query, and paginated incident queries with safe field selection. Public routes validate query parameters and return generic errors; no raw database error is included in a response.

The page requires the same environment variables as the rest of the app (`DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_APP_URL` for deployed origins). It does not require a new secret. The deployed URL is derived from the request origin; no production hostname is hardcoded.

## Automatic monitoring with Vercel Schedules

`vercel.json` configures a static Vercel Schedule named `pulsewatch-due-checks`. It sends a `GET` request to `/api/internal/run-checks` every 15 minutes, which is the shortest interval supported by Vercel Hobby Schedules. On Pro or Enterprise, change the expression to `*/5 * * * *` if monitors should be evaluated every five minutes.

Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set in the Production environment. The route compares that header with the application’s `CRON_SECRET` using a timing-safe comparison, then runs only monitors whose `nextCheckAt` is due. The database lease prevents duplicate or overlapping executions if GitHub Actions and Vercel both invoke the endpoint.

Setup:

1. Set `CRON_SECRET` in the Vercel Production environment to the same value used by the deployed app.
2. Push `vercel.json` and redeploy to production; Vercel creates schedules when the deployment becomes current.
3. Open **Schedules → pulsewatch-due-checks** in the Vercel dashboard and select **Run Schedule** to verify a 2xx response.
4. Wait for the next automatic run and confirm new `MonitorCheck` rows in Neon.

The route exports `maxDuration = 60` so multiple due checks can finish within one invocation. Vercel cron delivery is best effort and can be duplicated, so the scheduler is idempotent: due checks are selected by `nextCheckAt`, protected by `MonitorLease`, and skipped when another run already owns the monitor.

## Automatic monitoring with GitHub Actions

`.github/workflows/pulsewatch-monitor.yml` is a backup scheduler and manual trigger; Vercel Schedules is the primary automatic scheduler. The workflow declares `cron: "*/5 * * * *"` and supports manual execution. It sends a `POST` request to `PULSEWATCH_APP_URL/api/internal/run-checks` with the exact header `Authorization: Bearer <CRON_SECRET>`. The secret is read from the GitHub repository secret store, never from the workflow file or URL, and the job fails if the endpoint returns a non-2xx response.

GitHub scheduled events can be delayed, skipped, or not delivered in a repository. Confirm them by opening **Actions → PulseWatch monitor** and checking for runs whose trigger is `schedule`; a healthy workflow should show both `schedule` and `workflow_dispatch` runs. If only manual runs appear, keep Vercel Schedules enabled as the automatic source.

### Configure GitHub

1. In the repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Add `PULSEWATCH_APP_URL` with the deployed production origin as the value, for example `https://<your-domain>`. Do not include `/api` or a trailing slash.
3. Open **Settings → Secrets and variables → Actions → Secrets → New repository secret**.
4. Add `CRON_SECRET` with the same value configured in the deployed application environment. This value must be at least 16 characters.
5. Push the workflow to the default branch. Scheduled runs start automatically every five minutes after GitHub enables the workflow.
6. To trigger it manually, open **Actions → PulseWatch monitor → Run workflow**, choose the branch, and select **Run workflow**.

### Inspect execution logs

Open **Actions → PulseWatch monitor**, select a run, then open the **Run due monitor checks** job and the **Trigger PulseWatch checks** step. A successful request prints `Monitoring endpoint status: 200` and a summary such as `{ "due": 2, "executed": 2, "skipped": 0, "failed": 0 }`. A non-2xx response prints the status/body and fails the job.

### Verify real data in Neon

1. Before the first scheduled run, note the latest check time in Neon Studio or with `npm run db:studio`.
2. After a successful run, query the database:

```sql
SELECT "monitorId", status, "statusCode", "responseTime", "checkedAt"
FROM "MonitorCheck"
ORDER BY "checkedAt" DESC
LIMIT 20;
```

3. Confirm new rows appear for monitors whose `nextCheckAt` was due. If the endpoint returns `"due": 0`, nothing was scheduled yet and no new rows are expected.
4. Confirm monitor state advanced:

```sql
SELECT id, name, "currentStatus", "lastCheckedAt", "nextCheckAt"
FROM "Monitor"
WHERE "isActive" = true
ORDER BY "lastCheckedAt" DESC NULLS LAST;
```

5. Check `Incident` rows to confirm failures open/escalate after the configured threshold and recoveries resolve active incidents.

No mock monitoring data is created. Do not assume scheduled monitoring works until a real GitHub Actions scheduled run has succeeded and new `MonitorCheck` rows are visible in Neon.

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
6. Confirm a real Vercel Schedule invocation has succeeded before relying on automatic monitoring; treat GitHub Actions schedule runs as a backup signal.

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
6. Open `/analytics`, switch between `24h`, `7d`, `30d`, and `90d`, and confirm metrics/charts change from the stored check rows.
7. Call `GET /api/public/analytics/overview?range=30d`, `GET /api/public/analytics/uptime?range=30d`, `GET /api/public/analytics/response-time?range=30d`, `GET /api/public/analytics/incidents?range=30d`, and `GET /api/public/analytics/monitors?range=30d`.
8. Open a monitor detail link from the endpoint comparison table and confirm the trend and incident timeline match that monitor.
9. Open `/status` and confirm the overall state, service rows, uptime bars, and incident list match stored data.
10. Switch `/status` between `24h`, `7d`, and `30d` and confirm history changes from stored check rows.
11. Call `GET /api/public/status?range=24h`, `GET /api/public/status/monitors?range=30d`, and `GET /api/public/status/incidents?range=30d`; confirm invalid ranges return `400 invalid_query`.
12. Open the Vercel **Schedules** tab, run `pulsewatch-due-checks`, and confirm the invocation returns `200` with a `due`/`executed` summary.
13. Wait for the next automatic Vercel schedule and confirm new `MonitorCheck` rows in Neon Studio.
14. Inspect `Monitor`, `MonitorCheck`, `Incident`, and `MonitorLease` rows in Neon Studio with `npm run db:studio`.
15. Trigger the GitHub Actions workflow manually, check whether `schedule` runs also appear, and confirm new `MonitorCheck` rows as described in [Automatic monitoring with Vercel Schedules](#automatic-monitoring-with-vercel-schedules) and [Automatic monitoring with GitHub Actions](#automatic-monitoring-with-github-actions).

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
.github/workflows/
  pulsewatch-monitor.yml        Backup and manual monitoring trigger
vercel.json                     Primary automatic scheduler configuration
app/
  (dashboard)/                  Shared App Router shell and dashboard routes
  api/requests/execute/         Request execution API route
  api/public/                   Public read-only monitoring APIs
  api/admin/                    Admin auth, monitor, check, and workspace APIs
  api/cron/monitor/             Scheduled check trigger
  api/internal/run-checks/      POST alias used by GitHub Actions
  status/                       Standalone public status page
  layout.tsx                    Root layout and metadata
  page.tsx                      Redirects / to /dashboard
  not-found.tsx                 404 state
components/
  layout/                       Sidebar, topbar, search, menus, app shell
  dashboard/                    Live monitoring dashboard sections
  analytics/                    Analytics dashboard, charts, filters, and notices
  status/                       Public status overview, uptime bars, and incident list
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
  monitoring/                   Config, schemas, metrics, analytics calculations, sanitization, SSRF, engine
  status/                       Public status DTOs and derivation logic
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
   *.test.ts                     Monitoring metrics, analytics/status calculations, sanitization, SSRF, and schema tests
```
