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
| `ANTHROPIC_API_KEY` | Anthropic Console → API keys. Powers the AI-driven import chat workspace and `/admin/diagnostics`. Required — the chat importer can't start its first turn without it. |

Sentry vars are optional — leave blank to skip error monitoring locally.

### 3. Apply database migrations

The 15 SQL files in `supabase/migrations/` (numbered `0001`–`0009`, `0011`–`0017`) define the entire schema — tables, RLS policies, triggers, storage buckets, seeded lookups, the `access_level` model, passwords vault, manuals/guides, suppliers, and the AI-usage + diagnostics tables (`0017`).

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

## Access levels & bootstrap admin

The role enum has been replaced by an integer `profiles.access_level` with three values:

| Level | Label | What it can do |
|---|---|---|
| `3` | Admin | Everything: invite users, edit configs, approve change requests, view audit log |
| `2` | Manager | Edit clients/suppliers/tasks; cannot reach `/admin/*` |
| `1` | Editor | Read-only across most domains; can file change requests; manage own profile + tasks assigned to them |

The first time `farisosmanbhoy01@gmail.com` signs in, the `handle_new_auth_user` trigger (migration `0002`, updated by `0011_access_levels`) auto-promotes that account to `access_level = 3`. Every other new signup defaults to `access_level = 1` (Editor).

### How to add a new admin

**After the first admin exists** (recommended):
- Sign in as admin → `/admin/users` → invite the new admin's email → after they sign in, promote their level to **3 — Admin** inline from the same page.

**Before the first admin exists** (recovery):
```sql
update public.profiles set access_level = 3 where lower(email) = 'newowner@example.com';
```

### Handoff to the real FlipSide owner

When you're ready to hand over:
1. Have the new owner sign in (they'll land at Level 1 — Editor).
2. As current admin, go to `/admin/users` and change their level to **3 — Admin**.
3. They'll now see the `/admin` menu and can manage everything.
4. Optional: downgrade your own account to Level 1 (or deactivate it) once handoff is complete.

The bootstrap email in migration `0002` only matters for the *very first* sign-in — after that, level management is entirely UI-driven.

---

## Architecture conventions

- **Server Components by default.** Add `"use client"` only for interactive bits.
- **Server Actions** live in `actions.ts` next to the route that uses them. Always call `getSession()` or `requireLevel(min)` at the top.
- **`lib/access.ts` is the browser-safe entry point** for capability checks (`isAdmin`, `canManage`, `hasLevel`, `LEVEL_LABELS`). `lib/auth.ts` is `server-only` and re-exports server bits like `getSession` / `requireLevel`. Never import `lib/auth.ts` from a client component.
- **RLS is the gate, UI is the affordance.** Frontend hides edit buttons by level; the database refuses unauthorised writes regardless.
- **Soft-configurable lookups** (statuses, types, priorities, password categories, manual categories, …) live in DB tables editable at `/admin/config`. Don't hardcode option lists.
- **Audit triggers** are attached at the DB level (migration `0007`). New tables that should be audited need a `trg_audit_<table>` trigger.
- **Tailwind v4** uses CSS-based theme tokens in `app/globals.css` (`@theme { ... }`). No `tailwind.config.ts`.
- **PROPS three-pane list layout** (`ThreePaneLayout` + `DataTable` + `ContextPanel`) is the canonical pattern for list pages: filters left, table centre, context panel right (slideover below `xl`).

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
│   ├── (auth)/                       ← login, forgot-password, reset-password (brand gradient layout)
│   ├── (app)/                        ← all authenticated pages (TopHeader + MainNav + PageShell)
│   │   ├── page.tsx                  ← home dashboard (PROPS sidebar + tabbed hero card)
│   │   ├── (company)/                ← staff/, me/, company/profile/
│   │   ├── (administration)/         ← tasks/, passwords/, manuals/, admin/{users,config,audit,reports,suggestions,training}/
│   │   └── (operational)/            ← clients/, suppliers/
│   ├── api/
│   │   ├── admin/                    ← invite + level-set endpoints (service-role)
│   │   ├── search/                   ← universal search endpoint (CommandPalette)
│   │   └── notifications/            ← bell popover endpoint
│   └── auth/callback/                ← Supabase magic-link callback
├── components/
│   ├── ui/                           ← shared primitives + DataTable, ThreePaneLayout helpers
│   ├── nav/                          ← TopHeader, MainNav, Breadcrumbs, PageShell, nav-items
│   ├── layout/                       ← ThreePaneLayout, ContextPanel
│   ├── dashboard/                    ← BrandCard, ProfileCard, IndustryInfoCard, TasksNoticesCard, AlertRibbon
│   ├── clients/, suppliers/, tasks/, staff/, admin/
│   ├── CommandPalette.tsx, RealtimeRefresh.tsx, NotificationsPopover.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── access.ts                     ← browser-safe: AccessLevel, isAdmin, canManage, hasLevel, LEVEL_LABELS
│   ├── auth.ts                       ← server-only: getSession, requireLevel
│   ├── email/resend.ts               ← Resend client (no-op until key set)
│   ├── validators/                   ← shared Zod schemas
│   ├── notifications.ts              ← bell data source
│   ├── format.ts                     ← date/freshness/cn helpers
│   └── database.types.ts             ← hand-rolled DB types (access_level / required_level)
├── proxy.ts                          ← Next 16 proxy (session refresh)
├── instrumentation.ts                ← Sentry init
├── sentry.{client,server,edge}.config.ts
├── scripts/                          ← smoke-admin (invites), smoke-ai (Anthropic round-trip),
│                                       smoke-import (parser + applyPlan + chat turn),
│                                       smoke-diagnostics (scanner). Run with `npm run smoke:*`.
├── supabase/migrations/              ← 0001..0009, 0011..0017 — apply in order
└── public/brand/
```

> **End-user docs** live in [`USER_GUIDE.md`](./USER_GUIDE.md) — navigation map, SOPs for staff and admins, glossary, FAQ.

---

## Deploy (Netlify)

> **Production is already live at [`https://fsops.netlify.app`](https://fsops.netlify.app)** (Netlify project `fsops`, branch `main`). Pushing to `main` auto-deploys via `@netlify/plugin-nextjs`. The steps below are for setting up a fresh Netlify project from scratch — if you're just shipping a change to the existing one, skip them.

1. Push the repo to GitHub.
2. In Netlify, "Add new site → Import from Git" → select the repo.
3. Base directory: `flipside-ops`. Build command and publish dir are auto-detected by `@netlify/plugin-nextjs` (declared in `netlify.toml`).
4. Site settings → Environment variables: add every var from `.env.local`, but set `NEXT_PUBLIC_APP_URL` to the live Netlify URL.
5. Trigger a deploy.
6. Once live, add the Netlify URL to Supabase's Site URL + Redirect URL allowlist.

---

## AI features (import + diagnostics)

The Excel/CSV import chat and `/admin/diagnostics` page use Claude (Anthropic). Both are admin-only. Diagnostics degrades gracefully if `ANTHROPIC_API_KEY` is unset; the import chat needs it for the first turn.

- **Import chat workspace.** "Import" button on `/passwords`, `/clients`, `/suppliers` for admins. Opens a split-pane modal: chat on the left, tabbed live preview on the right. The AI parses the sheet, proposes mappings, sets defaults for missing required fields, resolves lookups, and surfaces every assumption as a per-cell warning. The user corrects in plain English ("default status to Active", "uppercase emails"). **The Import button is always enabled** — it says "Import 47 rows (3 need attention)" rather than blocking. Passwords have a hard privacy boundary: `username`, `password`, `further_info` are stripped before any AI request (both by header pattern and once a mapping is known).
- **Cross-domain awareness.** If a sheet uploaded to one domain contains data shaped like another (3+ matching columns), the AI proposes adding it as a new preview tab. User accepts in chat; the commit then inserts targets in dependency order with FK columns auto-wired (e.g. `passwords.client_id ← clients.name`). Pseudo-transactional — Supabase JS has no client-side transaction API, so partial failures trigger a best-effort rollback of the UUIDs already inserted.
- **Cost cap.** $0.20 per chat session, shown as a progress bar under the chat input. When hit, the current turn finishes and further turns are refused with a clear message.
- **Audit.** Every inserted row plus the full chat transcript is recorded — `/admin/audit` shows both. Useful for debugging "why did this row get this value".
- **Diagnostics scan.** `/admin/diagnostics` lets admins run an AI scan over clients or suppliers to surface likely duplicates, missing fields, and anomalies. Passwords are excluded from the scanner. Hard cap of ~$0.20 worth of tokens per scan.
- **Inline "Suggest" buttons.** On client / supplier detail pages, when `type_id` or `status_id` is empty, admins see a small "Suggest with AI" button that proposes a value with reasoning.
- **AI usage log.** Every Claude call is logged to `ai_usage_log` (model, tokens, cost, user) and surfaced at the top of `/admin/audit`.

Smoke scripts: `npm run smoke:ai`, `npm run smoke:import`, `npm run smoke:diagnostics` — each makes real Anthropic API calls (a few cents per run).

---

## Production-readiness gaps (post-launch follow-ups)

- **Resend integration** (currently using Supabase's default email). Needed before high-volume invites. Set `RESEND_API_KEY` + verify a sending domain.
- **Recurring task cron**: schema supports `recurring_template` type; the actual scheduler that spawns instances is not built. Add a Supabase Edge Function on a `pg_cron` schedule.
- **Auto-generated DB types**: `lib/database.types.ts` is hand-rolled. Once Supabase CLI is linked: `npx supabase gen types typescript --project-id ztikdgsygcisalbnqpjh > lib/database.types.ts`
- **Mobile responsive polish** on table-heavy pages (`/staff`, `/clients`, `/admin/audit`).
- **Departments seed**: empty by design — admins populate via `/admin/config` based on FlipSide's actual departments.
- **Higher-resolution logo**: `public/brand/logo.jpg` is a 17 KB JPG pulled from the WordPress site; replace with a vector when one becomes available.
