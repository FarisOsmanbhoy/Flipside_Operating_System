# Next Steps — FlipSide Ops

Living checklist. Update as items are completed so a fresh terminal / fresh
Claude session can pick up exactly where the previous one left off.

**Project root:** `C:\Users\osman\Documents\2. Projects\Flipside\FLIPSIDE OPERATING SYSTEM\flipside-ops`
**Supabase project ref:** `ztikdgsygcisalbnqpjh`
**Bootstrap admin email** (auto-seeded on first sign-in): `farisosmanbhoy01@gmail.com`
**Spec source of truth:** Notion page "FlipSide Internal Ops Tool — Design Spec (v1)" (id `36486ce8-4d64-811f-9056-c8f072052e01`)
**Plan file:** `C:\Users\osman\.claude\plans\can-you-look-into-fancy-teapot.md`

---

## ✅ Done in last session

- Scaffolded Next.js 16 + Tailwind v4 + TypeScript at `flipside-ops/`
- Brand theme wired: teal `#005470` primary, lime `#c2d500` accent, DM Sans + Josefin Sans
- All 9 Supabase migrations written under `supabase/migrations/` (extensions, profiles+departments, lookups, clients, tasks, change requests, audit log, storage)
- Auth flow: login (password + magic link), forgot, reset, callback
- App shell: top nav, avatar dropdown, role-aware admin link
- All 3 v1 modules: Staff, Clients (with sections + contacts + subs + request-change + approval queue), Tasks (with tabs + new + detail + comments + recurring conversion)
- Home dashboard with stat cards, my tasks, notices, recent activity, realtime refresh
- Admin pages: `/admin/{users,config,audit}` with invite via Supabase Admin API
- Shared UI primitives: Button, Card, Pill, Modal, Accordion, InlineEdit, Avatar, StalenessBadge, EmptyState, Toast, Input/Label/Select/Textarea
- `npm run build` passes (21 routes compile, TypeScript clean)
- README.md with setup instructions
- Logo + favicon downloaded from flipsidespecialties.com to `public/brand/`

---

## ⏳ Pending — in priority order

### 1. Supabase MCP not yet connected (BLOCKER for #2)
Symptom: only `mcp__supabase__authenticate` and `mcp__supabase__complete_authentication` show as tools. Real ones (`apply_migration`, `execute_sql`, `list_projects`) don't load.

**To resolve in a new session:**
- Have Claude run `mcp__supabase__authenticate` to emit a fresh OAuth URL
- Open the URL in browser, click Authorize
- The browser will try to redirect to `http://localhost:<port>/callback?code=...&state=...` and fail to load (expected — that local server isn't running)
- **Copy the full URL from the browser address bar** (it has the valid `code` param)
- Paste it back in chat; Claude calls `mcp__supabase__complete_authentication` with it
- Re-run `ToolSearch query="supabase list projects"` to confirm real tools appear

**Fallback if MCP keeps failing:**
- Put DB creds in `.env.local` (see #3 below) and apply migrations via `psql` or the Supabase CLI:
  ```sh
  npx supabase link --project-ref ztikdgsygcisalbnqpjh
  npx supabase db push
  ```

### 2. Apply 9 migrations to Supabase (BLOCKED by #1)
Order matters. Apply in numeric order:

1. `supabase/migrations/0001_extensions_and_helpers.sql` — pgcrypto, pg_trgm, audit trigger fn, `auth_role()`, `is_admin()`, `is_manager_or_admin()`
2. `supabase/migrations/0002_profiles_and_departments.sql` — profiles + departments + auth.users trigger
3. `supabase/migrations/0003_lookups.sql` — soft-config lookups + seed defaults
4. `supabase/migrations/0004_clients.sql` — clients + section data + contacts + subs + RLS
5. `supabase/migrations/0005_tasks.sql` — tasks + comments + RLS
6. `supabase/migrations/0006_change_requests.sql` — change requests + RLS
7. `supabase/migrations/0007_audit_log.sql` — audit log + triggers on all editable tables
8. `supabase/migrations/0008_storage.sql` — avatars / client-logos / client-docs buckets + RLS

Once MCP is wired, just say "apply all migrations" and Claude will run them via `mcp__supabase__apply_migration` one by one.

### 3. Fill `.env.local` with real Supabase keys
Currently no `.env.local` (a placeholder was created during the build smoke test, then removed).

```sh
cp .env.example .env.local
```

Then fill from the [Supabase dashboard → Project Settings → API](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/settings/api):

- `NEXT_PUBLIC_SUPABASE_URL` — `https://ztikdgsygcisalbnqpjh.supabase.co` (already set)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — copy "anon public" key
- `SUPABASE_SERVICE_ROLE_KEY` — copy "service_role" key (server-only, never commit)
- `RESEND_API_KEY` — sign up at resend.com if not already, create an API key
- `RESEND_FROM` — e.g. `"FlipSide Ops <noreply@flipsidespecialties.com>"` (must verify the sending domain in Resend)
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for dev

### 4. Configure Supabase dashboard (one-time)
- **Authentication → Providers → Email**: enable email + magic link
- **Authentication → URL Configuration → Site URL**: `http://localhost:3000` for dev; add prod URL when deployed
- **Authentication → URL Configuration → Redirect URLs**: add `http://localhost:3000/**` and any Vercel preview pattern
- **Authentication → SMTP** (after Resend key exists):
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: your Resend API key
  - Sender email matching `RESEND_FROM`

### 5. First sign-in + smoke test (BLOCKED by #2-#4)
```sh
cd "C:/Users/osman/Documents/2. Projects/Flipside/FLIPSIDE OPERATING SYSTEM/flipside-ops"
npm run dev
```
Visit `http://localhost:3000`:
- Redirected to `/login`
- Sign in via magic link to `farisosmanbhoy01@gmail.com`
- The `handle_new_auth_user` trigger creates a profile row with role `admin` (per the email match in migration 0002)
- Land on `/` dashboard

Verify each module:
- `/admin/users` — invite a second test user as `editor`; sign in incognito
- `/clients/new` — create a test client; edit Important info; add a contact + subcontractor
- As editor: open the client, confirm no edit buttons, file a request change
- As admin: approve it at `/clients/changes`; verify audit log entry at `/admin/audit`
- `/tasks/new` — create a task assigned to yourself; verify it appears on `/` dashboard

### 6. Commit foundation
The whole `flipside-ops/` folder is untracked. From the repo root:
```sh
git add flipside-ops/ .gitignore
git commit -m "feat: scaffold FlipSide internal ops tool (Next.js + Supabase)"
```
The repo's root `.gitignore` already excludes `.env`, `node_modules`, `.next`, `.claude/worktrees`, etc., so secrets won't leak.

### 7. Deploy to Vercel (after smoke test passes)
- Connect the repo in Vercel
- Set the same env vars as `.env.local` but use the production URL for `NEXT_PUBLIC_APP_URL`
- Add the Vercel hostnames to Supabase Site URL + Redirect URLs
- Push to main; Vercel auto-deploys

---

## 🔧 Known nits / quick polish (optional, post go-live)

- **Logo quality**: `public/brand/logo.jpg` was pulled from the WordPress site (17 KB). Replace with a vector / higher-res asset when one becomes available.
- **TopNav bell icon** is decorative — wire to a notifications popover in v1.1 (notices + assigned tasks + change request decisions).
- **Universal search** (Postgres FTS) is scaffolded in indexes but no search bar UI yet — spec §11 mentions it. Add a `<UniversalSearch />` to TopNav when needed.
- **Mobile responsive pass**: tables in `/staff`, `/clients`, `/admin/audit` overflow on small screens; they have `overflow-x-auto` wrappers but a card-layout fallback would be nicer.
- **Database types**: `lib/database.types.ts` is hand-written. Once Supabase CLI is linked, replace with:
  ```sh
  npx supabase gen types typescript --project-id ztikdgsygcisalbnqpjh > lib/database.types.ts
  ```
- **Departments seed**: currently empty. After admins decide on FlipSide's actual departments, seed via `/admin/config` or a small seed SQL file.
- **Recurring task generation**: schema supports `recurring_template` type + `recurrence` field, but the actual cron job that spawns instances from templates is not built. Add a Supabase Edge Function on a `pg_cron` schedule when needed.

---

## 📁 Where things live

```
flipside-ops/
├── app/
│   ├── (auth)/                  ← login, forgot-password, reset-password
│   ├── (app)/                   ← all authenticated pages
│   │   ├── page.tsx             ← home dashboard
│   │   ├── staff/, clients/, tasks/, me/, admin/
│   └── auth/callback/route.ts   ← Supabase magic-link callback
├── components/
│   ├── ui/                      ← shared primitives
│   ├── clients/, tasks/, staff/, admin/  ← feature-scoped
│   ├── TopNav.tsx, RealtimeRefresh.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── auth.ts                  ← getSession, requireRole
│   ├── format.ts                ← date/freshness/cn helpers
│   └── database.types.ts        ← hand-rolled DB types
├── proxy.ts                     ← Next.js 16 proxy (session refresh)
├── supabase/migrations/         ← 0001..0008.sql — apply in order
├── public/brand/                ← logo.jpg, favicon.jpg
├── README.md                    ← full setup walkthrough
└── NEXT_STEPS.md                ← this file
```

## 🔑 Conventions established (so future work stays consistent)

- **Server Components by default.** Add `"use client"` only for interactive bits (forms, modals, accordions, inline edit).
- **Server Actions in `actions.ts`** alongside the route they serve. Always call `getSession()` or `requireRole(...)` at the top.
- **RLS is the gate, UI is the affordance.** Frontend hides edit buttons by role; database refuses unauthorised writes regardless.
- **Soft-configurable lookups** live in DB tables editable at `/admin/config`. Don't hardcode option lists in code.
- **Audit triggers** are attached at the DB level (migration 0007). New tables that should be audited need a `trg_audit_<table>` trigger added there.
- **Tailwind v4** uses CSS-based theme tokens in `app/globals.css` (`@theme { ... }`). No `tailwind.config.ts`.
- **Next.js 16 specifics**:
  - `params` and `searchParams` are `Promise<...>` — always `await`
  - `cookies()` and `headers()` are async — always `await`
  - `middleware.ts` is now `proxy.ts` at the project root
  - Server Functions returned `void` should redirect or revalidate; client-callable ones should return data
