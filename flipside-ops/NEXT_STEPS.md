# Next Steps — FlipSide Ops

Living checklist. Update as items are completed so a fresh terminal / fresh
Claude session can pick up exactly where the previous one left off.

**Project root:** `C:\Users\osman\Documents\2. Projects\Flipside\FLIPSIDE OPERATING SYSTEM\flipside-ops`
**Supabase project ref:** `ztikdgsygcisalbnqpjh`
**GitHub repo (public):** `https://github.com/FarisOsmanbhoy/Flipside_Operating_System` — `main` at commit `3656ed6`
**Bootstrap admin email** (auto-seeded on first sign-in): `farisosmanbhoy01@gmail.com`
**Spec source of truth:** Notion page "FlipSide Internal Ops Tool — Design Spec (v1)" (id `36486ce8-4d64-811f-9056-c8f072052e01`)

---

## ✅ Done

- Scaffolded Next.js 16 + Tailwind v4 + TypeScript at `flipside-ops/` (23+ routes)
- Brand theme: teal `#005470` primary, lime `#c2d500` accent, DM Sans + Josefin Sans
- 11 Supabase migrations on disk (`0001`..`0009`, `0011_access_levels`, `0012_revoke_anon_from_auth_helpers`); all applied live to `ztikdgsygcisalbnqpjh`
- Auth flow: login (password + magic link), forgot, reset, callback
- App shell: TopHeader with universal search (Ctrl+K) + notifications popover + avatar dropdown; MainNav with click-toggle dropdowns + mobile hamburger
- All 3 v1 modules: Staff, Clients (sections + contacts + subs + request-change + approval queue), Tasks (tabs + new + detail + comments + recurring conversion)
- Home dashboard: greeting + stat row + tabbed tasks/notices/activity card + alert ribbon + industry-info widget + coming-soon cards + realtime refresh
- Admin pages: `/admin/{users,config,audit}` — Users uses the three-pane layout with an inline level editor; invite via Supabase Admin API
- Shared UI primitives: Button, Card, Pill (with `dot` variant), Modal, Accordion, InlineEdit, Avatar, StalenessBadge, EmptyState, Toast, Input/Label/Select (chevron caret) / Textarea, **ThreePaneLayout**, **DataTable** (sortable, selectable, status stripe), **ContextPanel**
- `npm run build` passes cleanly; `tsc --noEmit` clean
- Sentry instrumentation wired in `instrumentation.ts` + `sentry.{client,server,edge}.config.ts` (no-op until DSN set)
- `.env.local` populated; `netlify.toml` at repo root
- README rewritten with setup walkthrough + admin handoff docs
- Logo + favicon at `public/brand/`
- **PROPS three-pane redesign** (teal + lime preserved):
  - Fixed the two real UI bugs: `Select` had no chevron caret; `MainNav`'s `overflow-x-auto` was clipping dropdowns
  - List pages (`/staff`, `/clients`, `/tasks`, `/admin/users`, `/clients/changes`, `/admin/audit`) migrated to three-pane: left filter sidebar + central `DataTable` + right `ContextPanel` (slideover under `xl`)
  - `ClientsListClient`, `StaffListClient`, `TasksListClient`, `AdminUsersListClient`, `ChangeRequestsListClient`, `AuditListClient` each own row-selection state and drive the right pane
  - Shell widened to `max-w-[1440px]`; two-tone header strip; brand "+ New task" action button on the right of the nav
  - Auth pages get a brand gradient background + elevated card shadow + display-font headings
  - Dashboard adds an `AlertRibbon` + `IndustryInfoCard` alongside the existing tabbed tasks/notices/activity card; tab underline thickened
  - Reference mockups live in `assets/PROPS EXAMPLE 1..6.png` + `PROPS FLIGHTWORX.pdf`
- **Access-level model** (replaces the `admin/manager/editor` role enum):
  - `profiles.access_level int` with `check (between 1 and 3)`; `1 = Editor`, `2 = Manager`, `3 = Admin`
  - `client_section_types.required_level int` likewise
  - Helper functions kept the same NAMES — `is_admin()`, `is_manager_or_admin()` — but now read `access_level`, so the 21 existing RLS policies keep working unchanged
  - New `auth_level()` helper returns the int; `auth_role()` remains as a text shim
  - `EXECUTE` granted back to `authenticated` (this was the actual fix for the `permission denied for function is_admin` error introduced by an earlier blanket revoke); revoked from `anon`
  - `handle_new_auth_user` trigger defaults to level 1; bootstrap admin email gets level 3
  - Self-update RLS policy now pins `access_level` instead of `role` to prevent self-elevation
  - TS: new `lib/access.ts` (browser-safe primitives: `AccessLevel`, `SessionProfile`, `LEVEL_LABELS`, `isAdmin`, `canManage`, `hasLevel`); `lib/auth.ts` stays server-only and re-exports
  - `requireRole(...allowed)` → `requireLevel(min: AccessLevel)`
  - Server action renamed `setUserRole` → `setUserLevel`; UI shows "Level 3 — Admin / Level 2 — Manager / Level 1 — Editor"

---

## ⏳ Pending — in priority order

### 1. Connect Netlify (BLOCKER for production)
The Netlify MCP OAuth flow was started but not completed. To finish:
- Have Claude run `mcp__netlify__authenticate` to emit a fresh OAuth URL, OR
- Use the Netlify dashboard directly: "Add new site → Import from Git" → select `FarisOsmanbhoy/Flipside_Operating_System`
- `netlify.toml` already sets base directory to `flipside-ops/` and registers the Next.js plugin — auto-detect should work
- After site is created, note the assigned `*.netlify.app` URL

### 2. Configure Netlify environment variables (BLOCKED by #1)
In Site settings → Environment variables, add everything from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` — set to the Netlify URL (NOT localhost)

Leave Sentry / Resend vars blank for now.

### 3. Configure Supabase Auth dashboard (BLOCKED by #1)
At [Authentication → URL Configuration](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/url-configuration):
- **Site URL**: `https://<your-site>.netlify.app`
- **Redirect URLs**: add both
  - `http://localhost:3000/**` (for local dev)
  - `https://<your-site>.netlify.app/**` (for prod)
  - any Netlify deploy preview pattern if you'll use PR previews

At [Authentication → Providers](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/providers):
- Confirm **Email** provider is enabled (magic link + password)

### 4. First sign-in + smoke test (BLOCKED by #1–#3)
Once the site is live:
- Visit `https://<your-site>.netlify.app` → redirected to `/login`
- Sign in via magic link to `farisosmanbhoy01@gmail.com`
- `handle_new_auth_user` trigger creates a profile at `access_level = 3`
- Land on `/` dashboard

Verify each module:
- `/admin/users` — invite a second test user at **Level 1 (Editor)**; sign in incognito
- `/clients/new` — create a test client; edit Important info; add a contact + subcontractor
- As Level 1: open the client, confirm no edit buttons, file a request change
- As Level 3: approve at `/clients/changes`; verify audit log entry at `/admin/audit`
- `/tasks/new` — create a task assigned to yourself; verify it appears on `/` dashboard
- Universal search (Ctrl+K): type a client name → result appears → clicking navigates
- Notifications bell: assign yourself a task due soon → unread badge → popover lists it
- Top-nav dropdowns (Company / Administration / Operational) open on click and close on outside-click / Esc / route change
- Form `<Select>` controls show a visible chevron caret
- At `xl` viewport: row click on Staff/Clients/Tasks updates the right-hand context panel; below `xl` the right pane is a slideover

### 5. Move auth helpers out of `public` to clear advisor warnings
Three remaining `WARN`s flag that `is_admin()`, `is_manager_or_admin()`, `auth_level()` are SECURITY DEFINER in `public`, so PostgREST exposes them at `/rest/v1/rpc/...` for `authenticated`. They only read the caller's own profile, so risk is low — but the clean fix is:
- Create a new `auth_internal` schema
- Recreate the four helpers in `auth_internal` instead of `public`
- Update all 21 RLS policies to call the schema-qualified `auth_internal.is_admin()` etc.
- Drop the old `public.*` copies

This needs careful sequencing (alter policies before dropping functions, or drop policies + recreate). Plan as a single migration.

### 6. Finish the PROPS stub pages
The redesign shipped placeholders for these — they render an `EmptyState`:
- **`/company/profile`** — needs a `company_profile` table + editable form
- **`/admin/reports`** — saved queries / scheduled exports; no DB or API yet
- **`/admin/suggestions`** — paired with the "Suggestions & Feedback" dashboard card; lightweight inbox
- **`/admin/training`** — training modules + completion tracking per staff member
- **Dashboard "Polls" card** — `ComingSoonCard` with no backing route or table
- **Dynamic breadcrumb labels** — show truncated UUIDs for `/clients/[id]` / `/tasks/[id]`; needs server-rendered or context-fed labels

### 7. (Optional) Wire Sentry DSN
- Create a Sentry account + project for Node.js / Next.js
- Copy the DSN
- Add to `.env.local` and Netlify env:
  - `NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest.sentry.io/...`
  - `SENTRY_ORG=<your-org-slug>`
  - `SENTRY_PROJECT=<your-project-slug>`
  - `SENTRY_AUTH_TOKEN=<auth-token>` (for source-map upload in CI)
- Redeploy; force a test error from a server action; verify it shows up in Sentry

---

## 🔑 Pending auths / external setup

- **Netlify MCP** — still not connected (see Pending #1). `netlify.toml` is unchanged; the build is green; the site will deploy as-is once Netlify is hooked up.
- **Supabase MCP** — connected and used during scaffolding, the redesign, AND the access-level migration. Database is in sync with on-disk migrations through `0012`.
- **No new env vars** required since the prior commit.
- **No new third-party services** added.

---

## 🔧 Production-readiness backlog (post-launch)

- **Departments seed**: empty by design. After FlipSide decides on their actual departments, populate via `/admin/config`.
- **Resend integration**: currently using Supabase's default email provider. Swap before high-volume invites:
  - Sign up at resend.com, verify a sending domain (e.g., `flipsidespecialties.com`)
  - Add `RESEND_API_KEY` + `RESEND_FROM` to env
  - In Supabase Auth → SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = API key
- **Auto-generated DB types**: `lib/database.types.ts` is hand-rolled. Once Supabase CLI is linked:
  ```sh
  npx supabase gen types typescript --project-id ztikdgsygcisalbnqpjh > lib/database.types.ts
  ```
- **Recurring task cron**: schema supports `recurring_template` type + `recurrence` field, but the scheduler that spawns instances from templates is not built. Add a Supabase Edge Function on a `pg_cron` schedule.
- **Mobile responsive polish**: tables in `/staff`, `/clients`, `/admin/audit` use `overflow-x-auto` wrappers; a card-layout fallback would be nicer on small screens.
- **Higher-resolution logo**: `public/brand/logo.jpg` is a 17 KB JPG pulled from WordPress. Replace with vector / higher-res when available.
- **Move `pg_trgm` extension** out of public schema (pre-existing advisor WARN).
- **PR preview deploys**: Netlify supports these automatically — just add the Netlify preview URL pattern to Supabase Redirect URLs.
- **Pre-existing lint errors**: `npx eslint .` reports 6 errors in `app/(app)/page.tsx`, `components/CommandPalette.tsx`, `components/NotificationsPopover.tsx` (React 19 `react-hooks/purity` + `set-state-in-effect`). All pre-date the redesign; cleanup pass when convenient.

---

## 📁 Where things live

```
flipside-ops/
├── app/
│   ├── (auth)/                  ← login, forgot-password, reset-password (brand gradient layout)
│   ├── (app)/                   ← all authenticated pages (shell: TopHeader + MainNav + PageShell)
│   │   ├── page.tsx             ← home dashboard (alert ribbon + stat row + tabbed card + widgets)
│   │   ├── (company)/staff/, me/, company/profile/
│   │   ├── (administration)/tasks/, admin/{users,config,audit,reports,suggestions,training}/
│   │   └── (operational)/clients/
│   ├── api/
│   │   ├── admin/invite/        ← invite user via Supabase Admin API (accepts access_level)
│   │   ├── search/              ← universal search endpoint (CommandPalette)
│   │   └── notifications/       ← bell popover endpoint
│   └── auth/callback/route.ts   ← Supabase magic-link callback
├── components/
│   ├── ui/                      ← shared primitives + DataTable + Pill `dot` variant
│   ├── nav/                     ← TopHeader, MainNav (click-toggle + hamburger), Breadcrumbs, PageShell, nav-items
│   ├── layout/                  ← ThreePaneLayout, ContextPanel
│   ├── dashboard/               ← TasksNoticesCard, AlertRibbon, IndustryInfoCard, ComingSoonCard
│   ├── clients/                 ← ClientsFilters, ClientsListClient, ChangeRequestsListClient, …
│   ├── tasks/                   ← TasksFilters, TasksListClient, TaskForm, CommentsThread
│   ├── staff/                   ← StaffFilters, StaffListClient, ProfileEditForm
│   ├── admin/                   ← AdminUsersListClient, UserContextPanel, AuditListClient, InviteUserButton, LookupEditor
│   ├── CommandPalette.tsx, RealtimeRefresh.tsx, NotificationsPopover.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── access.ts                ← AccessLevel, SessionProfile, LEVEL_LABELS, isAdmin/canManage/hasLevel (browser-safe)
│   ├── auth.ts                  ← server-only: getSession, requireLevel (re-exports from access.ts)
│   ├── notifications.ts         ← bell data source
│   ├── format.ts                ← date/freshness/cn helpers
│   └── database.types.ts        ← hand-rolled DB types (access_level / required_level)
├── proxy.ts                     ← Next 16 proxy (session refresh)
├── instrumentation.ts           ← Sentry init entrypoint
├── sentry.{client,server,edge}.config.ts
├── supabase/migrations/         ← 0001..0009, 0011_access_levels, 0012_revoke_anon_from_auth_helpers
├── public/brand/                ← logo.jpg, favicon.jpg
├── README.md                    ← full setup walkthrough + handoff docs
└── NEXT_STEPS.md                ← this file
```

`netlify.toml` lives at the *repo* root (one level above `flipside-ops/`).
`assets/` (also at repo root) holds the PROPS reference mockups + FlightWorx sample PDF.

## 🔑 Conventions

- **Server Components by default.** Add `"use client"` only for interactive bits.
- **Server Actions in `actions.ts`** alongside the route. Always call `getSession()` or `requireLevel(min)` at the top.
- **RLS is the gate, UI is the affordance.** Frontend hides edit buttons by level; the database refuses unauthorised writes regardless.
- **Capability checks**: prefer `isAdmin(p)` / `canManage(p)` from `lib/access.ts` over raw `access_level >= n` comparisons.
- **`lib/auth.ts` is `server-only`** — never import it from a client component. For client components, import types and pure helpers from `lib/access.ts` instead.
- **Soft-configurable lookups** live in DB tables editable at `/admin/config`. Don't hardcode option lists.
- **Audit triggers** are attached at the DB level (migration `0007`). New audited tables need a `trg_audit_<table>` trigger.
- **Tailwind v4** uses CSS-based theme tokens in `app/globals.css` (`@theme { ... }`). No `tailwind.config.ts`.
- **List-page pattern**: server page fetches → passes plain serializable data to a `<XListClient>` client wrapper → wrapper renders `<ThreePaneLayout>` + `<DataTable>` + `<ContextPanel>` and owns row-selection state.
- **`ThreePaneLayout` quirk**: the optional `context` slot renders into both a sticky right pane (≥ `xl`) and a slideover (< `xl`). Both copies are in the DOM, so avoid global `id` attributes inside context-pane content.
- **Next.js 16 specifics:**
  - `params` and `searchParams` are `Promise<...>` — always `await`
  - `cookies()` and `headers()` are async — always `await`
  - `middleware.ts` is now `proxy.ts` at the project root
  - Server Functions returning `void` should redirect or revalidate; client-callable ones should return data
