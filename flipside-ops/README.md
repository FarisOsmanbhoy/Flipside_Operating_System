# FlipSide Ops

Internal operations tool for FlipSide Specialties — staff directory, client knowledge base, and task/notice tracking.

Built on **Next.js 16 (App Router)**, **Supabase** (Postgres + Auth + Storage + RLS), and **Tailwind v4**.

---

## Setup (local dev)

### 1. Install

```sh
cd flipside-ops
npm install
```

### 2. Environment

```sh
cp .env.example .env.local
```

Fill from the [Supabase dashboard → Project Settings → API](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/settings/api):

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role secret" key (server-only) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev, deploy URL in prod |

Sentry vars are optional — leave blank to skip error monitoring locally.

### 3. Apply database migrations

The 8 SQL files in `supabase/migrations/` define the entire schema (tables, RLS policies, triggers, storage buckets, seeded lookups).

If you're picking this up fresh and the project doesn't have them applied yet, use the Supabase MCP `apply_migration` tool or run them via the SQL editor in order.

### 4. Configure Supabase Auth dashboard

In [Authentication → URL Configuration](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/url-configuration):
- **Site URL**: `http://localhost:3000` (add prod URL after deploy)
- **Redirect URLs**: `http://localhost:3000/**`, plus your prod URL pattern

In [Authentication → Providers](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/providers):
- Enable **Email** provider (magic link + password both work)

### 5. Run

```sh
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`. Sign in via magic link.

---

## Bootstrap admin

The first time `farisosmanbhoy01@gmail.com` signs in, the `handle_new_auth_user` trigger (migration `0002`) auto-promotes that account to `admin` role. Every other new signup defaults to `editor`.

### How to add a new admin

**After the first admin exists** (recommended):
- Sign in as admin → `/admin/users` → invite the new admin's email → after they sign in, promote their role to `admin` from the same page.

**Before the first admin exists** (recovery):
```sql
update public.profiles set role = 'admin' where lower(email) = 'newowner@example.com';
```

### Handoff to the real FlipSide owner

When you're ready to hand over:
1. Have the new owner sign in (they'll land as `editor`).
2. As current admin, go to `/admin/users` and change their role to `admin`.
3. They'll now see the `/admin` menu and can manage everything.
4. Optional: downgrade your own account to `editor` (or deactivate it) once handoff is complete.

The bootstrap email in migration `0002` only matters for the *very first* sign-in — after that, role management is entirely UI-driven.

---

## Architecture conventions

- **Server Components by default.** Add `"use client"` only for interactive bits.
- **Server Actions** live in `actions.ts` next to the route that uses them. Always call `getSession()` or `requireRole(...)` at the top.
- **RLS is the gate, UI is the affordance.** Frontend hides edit buttons by role; the database refuses unauthorised writes regardless.
- **Soft-configurable lookups** (statuses, types, priorities…) live in DB tables editable at `/admin/config`. Don't hardcode option lists.
- **Audit triggers** are attached at the DB level (migration `0007`). New tables that should be audited need a `trg_audit_<table>` trigger.
- **Tailwind v4** uses CSS-based theme tokens in `app/globals.css` (`@theme { ... }`). No `tailwind.config.ts`.

### Next.js 16 specifics
- `params` and `searchParams` are `Promise<...>` — always `await`
- `cookies()` and `headers()` are async — always `await`
- `middleware.ts` is now `proxy.ts` at the project root
- Server Functions returning `void` should redirect or revalidate; client-callable ones should return data

---

## File map

```
flipside-ops/
├── app/
│   ├── (auth)/           ← login, forgot-password, reset-password
│   ├── (app)/            ← all authenticated pages
│   │   ├── page.tsx      ← home dashboard
│   │   ├── staff/, clients/, tasks/, me/, admin/
│   ├── api/
│   │   ├── search/       ← universal search endpoint
│   │   └── notifications/← bell popover endpoint
│   └── auth/callback/    ← Supabase magic-link callback
├── components/
│   ├── ui/                          ← shared primitives
│   ├── clients/, tasks/, staff/, admin/
│   ├── TopNav.tsx, RealtimeRefresh.tsx,
│   ├── UniversalSearch.tsx, NotificationsPopover.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── auth.ts           ← getSession, requireRole
│   ├── notifications.ts  ← bell data source
│   ├── format.ts         ← date/freshness/cn helpers
│   └── database.types.ts ← hand-rolled DB types
├── proxy.ts              ← Next 16 proxy (session refresh)
├── instrumentation.ts    ← Sentry init
├── sentry.{client,server,edge}.config.ts
├── supabase/migrations/  ← 0001..0010.sql — apply in order
└── public/brand/
```

---

## Deploy (Netlify)

1. Push the repo to GitHub.
2. In Netlify, "Add new site → Import from Git" → select the repo.
3. Base directory: `flipside-ops`. Build command and publish dir are auto-detected by `@netlify/plugin-nextjs` (declared in `netlify.toml`).
4. Site settings → Environment variables: add every var from `.env.local`, but set `NEXT_PUBLIC_APP_URL` to the live Netlify URL.
5. Trigger a deploy.
6. Once live, add the Netlify URL to Supabase's Site URL + Redirect URL allowlist.

---

## Production-readiness gaps (post-launch follow-ups)

- **Resend integration** (currently using Supabase's default email). Needed before high-volume invites. Set `RESEND_API_KEY` + verify a sending domain.
- **Recurring task cron**: schema supports `recurring_template` type; the actual scheduler that spawns instances is not built. Add a Supabase Edge Function on a `pg_cron` schedule.
- **Auto-generated DB types**: `lib/database.types.ts` is hand-rolled. Once Supabase CLI is linked: `npx supabase gen types typescript --project-id ztikdgsygcisalbnqpjh > lib/database.types.ts`
- **Mobile responsive polish** on table-heavy pages (`/staff`, `/clients`, `/admin/audit`).
- **Departments seed**: empty by design — admins populate via `/admin/config` based on FlipSide's actual departments.
- **Higher-resolution logo**: `public/brand/logo.jpg` is a 17 KB JPG pulled from the WordPress site; replace with a vector when one becomes available.
