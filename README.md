# PulseWatch

PulseWatch is a production-focused API availability and performance monitoring app. The public site at `/` and `/status` is read-only and built from stored monitor checks. Everything else is an administrator workspace protected by server-side session checks, an edge proxy, and CSRF validation.

Deployed public origin: `https://health.nepsesuchana.qzz.io`

## Overview

- Public overview: current health, uptime and response-time charts, P95 latency, failed checks, latency/reliability/incident analytics, and a paginated monitor table.
- Public status page: detailed availability bars, current service state, and incident history.
- Admin workspace: dashboard, analytics, monitors, incidents, API tester, collections, environments, check history, and settings.
- No demo or mock monitoring data. If the database is not configured or has no checks, the UI says so.
- Monitor URLs, headers, request bodies, credentials, and admin routes are never exposed on public pages or public APIs.

## Features

- Real checks stored in Neon PostgreSQL through Prisma.
- Server-side HTTP execution with SSRF protections, safe IP/DNS resolution, size limits, timeouts, and sanitized error messages.
- Incident creation, resolution, occurrence counts, and uptime calculations.
- Range selectors: 24h, 7d, 30d, and 90d on the public overview; 24h, 7d, and 30d on the status page.
- Secure admin sessions: signed HS256 JWT in an `HttpOnly`, `SameSite=Lax` cookie; production cookies are `Secure`.
- CSRF token and same-origin checks for admin mutations.
- Scheduled monitoring with Vercel Cron and GitHub Actions fallback.
- Auto-refresh on public pages every 45 seconds without overlapping requests.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript.
- Tailwind CSS 4, shadcn/Base UI components, Recharts, Lucide icons.
- Prisma 7 with `@prisma/adapter-neon` and Neon PostgreSQL.
- Zod for validation, `jose` for signed sessions, bcryptjs for password hashing.
- Vitest, ESLint, and TypeScript for verification.

## Project Structure

```text
app/
  (dashboard)/          Admin-only pages
  api/admin/            Session, monitor, and workspace APIs
  api/public/           Sanitized public read APIs
  api/cron/             Cron endpoint
  api/internal/         GitHub Actions cron alias
  api/requests/         Admin-only request executor
  login/                Administrator sign-in page
  status/               Public status page
  page.tsx              Public overview dashboard
components/
  auth/                 Login form
  dashboard/            Public dashboard and admin dashboard cards/charts
  layout/               Admin shell, sidebar, topbar, mobile navigation
  monitors/             Monitor manager
  requests/             API tester
  shared/               Public header, status pills, notices, brand
  status/               Public status page
lib/
  auth/                 Session tokens, guards, DAL, redirect helpers
  data/                 Public dashboard, analytics, status, and overview queries
  monitoring/           Engine, leases, metrics, sanitization, schemas
  status/               Status derivation and DTOs
prisma/schema.prisma    Database schema
proxy.ts                Route protection before rendering/API handlers
tests/                  Vitest suites
```

## Environment Variables

Create `.env.local` for local development:

```bash
DATABASE_URL="postgresql://...pooled...neon.tech/...?sslmode=require"
DIRECT_URL="postgresql://...direct...neon.tech/...?sslmode=require"
AUTH_SECRET="at-least-32-random-characters"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="at-least-12-characters"
CRON_SECRET="at-least-16-random-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- `DATABASE_URL`: pooled Neon connection string used by the runtime Prisma client.
- `DIRECT_URL`: direct Neon connection string used by Prisma CLI and migrations.
- `AUTH_SECRET`: signs admin session JWTs. Must be at least 32 characters.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: used once by `npm run admin:create`. Password must be at least 12 characters.
- `CRON_SECRET`: bearer secret for `/api/cron/monitor` and `/api/internal/run-checks`. Must be at least 16 characters.
- `NEXT_PUBLIC_APP_URL`: public origin used for same-origin validation. Use `https://health.nepsesuchana.qzz.io` in production.

Use different values for each environment and never commit secrets.

## Local Development

1. Install dependencies: `npm install`.
2. Create `.env.local` with the variables above.
3. Generate the Prisma client: `npm run prisma:generate`.
4. Apply the schema: `npm run db:deploy` (or `npm run db:migrate` while developing locally).
5. Create the first administrator: `npm run admin:create`.
6. Start the app: `npm run dev`.
7. Open `http://localhost:3000` for the public overview and `http://localhost:3000/login` for admin access.

Add monitors at `/monitors`. Only monitors with `isActive = true` and `displayPublicly = true` appear on public pages and APIs.

## Admin Access

- Sign in at `/login`; there is no public registration or signup route.
- Sessions last eight hours and are stored in the `pulsewatch_admin_session` cookie.
- `proxy.ts` redirects unauthenticated private pages to `/login?next=...` and returns 401 JSON for private APIs.
- Admin APIs also call `authorizeAdmin()` server-side; mutations require the `x-csrf-token` header and a same-origin `Origin`/`Referer`.
- Private pages call `requireAdminPage()` in the admin layout, and sensitive pages require it again where they read the session.

## Public Pages

- `/`: public overview with a compact status table, pagination, sorting, range selector, charts, and recent incidents.
- `/status`: detailed status page with uptime bars and incident updates.
- `/login`: administrator sign-in. This is the only non-public piece of navigation shown on public pages.

Public status mapping:

- `OPERATIONAL`: `All Systems Operational.`
- `DEGRADED`: `Partial System Degradation.`
- `OUTAGE`: `Major System Outage.`
- `NO_DATA`: `Monitoring Data Delayed.`

Missing checks are treated as unknown; they never count as successful uptime.

## Admin Pages

- `/dashboard`: live overview from stored checks.
- `/analytics` and `/analytics/[monitorId]`: uptime, latency, and incident analytics.
- `/monitors`: create, edit, run, and delete monitors.
- `/incidents`: stored incidents.
- `/requests`, `/collections`, `/environments`, `/history`: API workspace and check history.
- `/settings`: account, public links, and configuration status.

## API Routes

Public, sanitized endpoints:

- `GET /api/public/dashboard?range=24h|7d|30d|90d`
- `GET /api/public/status?range=24h|7d|30d`
- `GET /api/public/status/monitors`, `/api/public/status/incidents`
- `GET /api/public/overview`, `/api/public/monitors`, `/api/public/incidents`
- `GET /api/public/analytics/overview`, `/uptime`, `/response-time`, `/incidents`, `/monitors`
- `GET /api/public/monitors/[id]/history` and `/analytics`

Admin endpoints require the session cookie and CSRF token:

- `/api/admin/monitors`, `/api/admin/monitors/[id]`, `/api/admin/monitors/[id]/check`
- `/api/admin/workspace`, `/api/admin/session`
- `/api/requests/execute`

Request execution is disabled in production unless a dedicated authenticated proxy is configured. Monitor checks use the same server-side executor with its own rate limits and database lease.

Cron endpoints require `Authorization: Bearer <CRON_SECRET>`:

- `GET|POST /api/cron/monitor`
- `POST /api/internal/run-checks`

## Monitoring Scheduler

- Vercel Cron uses `vercel.json` to call `/api/internal/run-checks` every 15 minutes.
- GitHub Actions uses `.github/workflows/pulsewatch-monitor.yml` every 5 minutes and for manual dispatch.
- The workflow reads `PULSEWATCH_APP_URL` from repository variables and `CRON_SECRET` from repository secrets.
- A Prisma `MonitorLease` prevents duplicate or overlapping checks when both schedulers run.
- Only due monitors (`nextCheckAt <= now`) are checked.

## Deployment

Deploy to Vercel with Neon PostgreSQL:

1. Create a Neon project and use its pooled and direct connection strings for `DATABASE_URL` and `DIRECT_URL`.
2. Set all environment variables in the Vercel Production environment.
3. Run `npm run db:deploy` against the production database.
4. Run `npm run admin:create` with production `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_URL` set locally.
5. Deploy the app and confirm the public origin is `https://health.nepsesuchana.qzz.io`.
6. Set `NEXT_PUBLIC_APP_URL` to that origin, including the scheme and no trailing slash.
7. Set the same `CRON_SECRET` in Vercel and GitHub.
8. Add `PULSEWATCH_APP_URL=https://health.nepsesuchana.qzz.io` as a GitHub repository variable.

## Security

- Public DTOs contain no monitor URLs, headers, request bodies, credentials, or internal IDs beyond public monitor/incident identifiers.
- Error messages are sanitized before storage or display.
- SSRF protections block local, private, link-local, multicast, reserved, metadata, and DNS-rebinding targets.
- Responses are size-limited, redirects are bounded, and unsafe headers are stripped.
- Admin mutations require session, CSRF, and origin validation.
- Cookie flags are `HttpOnly`, `SameSite=Lax`, `Secure` in production, with an eight-hour expiry.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover status derivation, analytics and metric calculations, sanitization, schemas, SSRF rules, auth tokens, safe redirects, and proxy route protection.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma client and build the app |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting |
| `npm test` | Run Vitest suites |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:studio` | Open Prisma Studio |
| `npm run admin:create` | Create the first administrator |