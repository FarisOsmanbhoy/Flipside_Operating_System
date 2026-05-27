# Next Steps — FlipSide Ops

Living checklist. Update as items are completed so a fresh terminal / fresh
Claude session can pick up exactly where the previous one left off.

**Project root:** `C:\Users\osman\Documents\2. Projects\Flipside\FLIPSIDE OPERATING SYSTEM\flipside-ops`
**Supabase project ref:** `ztikdgsygcisalbnqpjh`
**GitHub repo (public):** `https://github.com/FarisOsmanbhoy/Flipside_Operating_System` — `main` at commit `36b942f`
**Bootstrap admin email** (auto-seeded on first sign-in): `farisosmanbhoy01@gmail.com`
**Spec source of truth:** Notion page "FlipSide Internal Ops Tool — Design Spec (v1)" (id `36486ce8-4d64-811f-9056-c8f072052e01`)

---

## ✅ Done

- Scaffolded Next.js 16 + Tailwind v4 + TypeScript at `flipside-ops/` (30+ routes)
- Brand theme: teal `#005470` primary, lime `#c2d500` accent, DM Sans + Josefin Sans
- 15 Supabase migrations on disk (`0001`..`0009`, `0011_access_levels`, `0012_revoke_anon_from_auth_helpers`, `0013_profile_fields_expansion`, `0014_password_metadata`, `0015_passwords_and_manuals`, `0016_suppliers`, `0017_ai_assist`); all applied live to `ztikdgsygcisalbnqpjh`
- Auth flow: login (password + magic link), forgot, reset, callback
- App shell: TopHeader with universal search (Ctrl+K) + notifications popover + avatar dropdown; MainNav with click-toggle dropdowns + mobile hamburger
- All 3 v1 modules: Staff, Clients (sections + contacts + subs + request-change + approval queue), Tasks (tabs + new + detail + comments + recurring conversion)
- Home dashboard: greeting + 2-column layout (brand/profile sidebar, hero tabbed card with industry/tasks/notices/activity + bottom coming-soon row) + alert ribbon + realtime refresh
- Admin pages: `/admin/{users,config,audit}` — Users uses the three-pane layout with an inline level editor; invite via Supabase Admin API
- Shared UI primitives: Button, Card, Pill (with `dot` variant), Modal, Accordion, InlineEdit, Avatar, StalenessBadge, EmptyState, Toast, Input/Label/Select (chevron caret) / Textarea, **ThreePaneLayout**, **DataTable** (sortable, selectable, status stripe), **ContextPanel**
- `npm run build` passes cleanly; `tsc --noEmit` clean
- Sentry instrumentation wired in `instrumentation.ts` + `sentry.{client,server,edge}.config.ts` (no-op until DSN set)
- `.env.local` populated; `netlify.toml` at repo root
- **Netlify deploy + MCP**: project `fsops` (site id `5bef33e3-f276-47cd-ab2c-a6451ac01107`) live at [`https://fsops.netlify.app`](https://fsops.netlify.app); branch deploy at `https://main--fsops.netlify.app`. Netlify MCP authenticated and used for env-var management (e.g. `SUPABASE_SERVICE_ROLE_KEY` set via commit `e2e5cb8`); pushes to `main` auto-deploy.
- README rewritten with setup walkthrough + admin handoff docs
- Logo + favicon at `public/brand/`
- **PROPS three-pane redesign** (teal + lime preserved):
  - Fixed the two real UI bugs: `Select` had no chevron caret; `MainNav`'s `overflow-x-auto` was clipping dropdowns
  - List pages (`/staff`, `/clients`, `/tasks`, `/admin/users`, `/clients/changes`, `/admin/audit`) migrated to three-pane: left filter sidebar + central `DataTable` + right `ContextPanel` (slideover under `xl`)
  - `ClientsListClient`, `StaffListClient`, `TasksListClient`, `AdminUsersListClient`, `ChangeRequestsListClient`, `AuditListClient` each own row-selection state and drive the right pane
  - Shell widened to `max-w-[1440px]`; two-tone header strip; brand "+ New task" action button on the right of the nav
  - Auth pages get a brand gradient background + elevated card shadow + display-font headings
  - Dashboard: `AlertRibbon` + tabbed hero card (Industry | Tasks | Notices | Activity) with count badges; industry content in first tab; three coming-soon cards in a bottom row
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

### Since `3656ed6` (PROPS redesign)

- **Admin onboarding + profile expansion** (`a671828`): extension, DOB, job title, car reg, specialisation fields on `profiles` (migration `0013`); avatar uploads wired through Supabase storage; admin can populate these on staff records.
- **PROPS-style left sidebar on Home** (`90ff8fd`): brand card + profile card in the dashboard sidebar; "+ New notice" is now the default top-nav action.
- **Self-service password change + recovery-link fix** (`8e45b62`, `553f154`): `components/staff/ChangeMyPasswordCard.tsx`, `password_set_at` metadata (migration `0014`), login password visibility toggle, profile save crash fixed.
- **FLIGHTWORX home layout** (`f1970c6`): full dashboard refresh — `AlertRibbon`, `BrandCard`, `ProfileCard`, `IndustryInfoCard`, `TasksNoticesCard`.
- **Passwords vault + Manuals & Guides** (`7a25973`): two new domains under Administration, backed by migration `0015`; both have soft-configurable categories editable at `/admin/config`. Pages live at `/passwords` and `/manuals`.
- **Teal sidebar Add buttons + wider passwords/manuals** (`3b3a7d4`): consistent "+ Add" placement across all list pages; passwords/manuals layouts widened.
- **Suppliers domain + level-3 PM reassignment + change-requests as tasks** (`7cd3656`): new `/suppliers` parallel to `/clients` (migration `0016`, no sub-suppliers); only Level 3 can reassign a client/supplier's assigned PM; change requests now flow through Tasks instead of a standalone list page.
- **Admin invite diagnostics + smoke script** (`22d12c3`): invite button renamed; failure modes logged with actionable messages; `scripts/smoke-admin.ts` added (run with `npx tsx scripts/smoke-admin.ts`).

### Since `22d12c3` (admin invite diagnostics)

- **Portal Modal to `document.body`** (`c3be34e`): overlay now covers sticky siblings instead of being clipped by a sticky ancestor.
- **Ops deploy chores** (`edfc42c`, `e2e5cb8`, `bdb7e3f`): set `SUPABASE_SERVICE_ROLE_KEY` as a non-secret env on the `fsops` Netlify site and added runtime env-check logging in the admin invite path so missing keys produce an actionable error instead of a generic 500.
- **AI-assisted Excel import + diagnostics** (`fe2a8bd`): first cut — migration `0017_ai_assist` adds `ai_usage_log` + `ai_diagnostics`; `lib/ai/` wraps the Anthropic SDK with a server-only guard, Zod-validated structured outputs, and per-call usage logging; `/admin/diagnostics` runs a $0.20-capped scan over clients/suppliers; inline "Suggest with AI" buttons on detail pages for empty `type_id` / `status_id`. Three smoke scripts: `smoke-ai`, `smoke-import`, `smoke-diagnostics`.
- **Chat-driven import workspace** (`36b942f`): replaces the gated 5-step `ImportWizard` with a single chat-driven modal — split chat on the left, tabbed live preview on the right. AI is the driver now, not a one-shot suggester: it makes assumptions, surfaces them as per-cell badges, the user corrects in plain English ("default status to Active"), nothing blocks the user (missing required fields get defaults + warnings). New foundation: `lib/import/planState.ts` (Zod schemas), `lib/import/applyPlan.ts` (pure resolver), `lib/import/crossDomainCommit.ts` (topo-sort + FK wiring + best-effort rollback). Cross-domain awareness: AI spots data shaped like another domain, proposes a new preview tab, and on commit inserts targets in dependency order with FKs auto-wired. `$0.20` per-session cost cap shared with diagnostics; full chat transcript recorded in `/admin/audit`. Removed: `ImportWizard.tsx`, `mapColumns.ts`, `clarifyMapping.ts`.

---

## ⏳ Pending — in priority order

### 1. Verify Netlify environment variables on `fsops`
The critical vars are obviously set (deploy is `ready` and admin invite works), but confirm the full set on the [`fsops` Netlify project → Site settings → Environment variables](https://app.netlify.com/projects/fsops):
- `NEXT_PUBLIC_SUPABASE_URL` — confirmed (admin invite reads it)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — confirmed (client auth works)
- `SUPABASE_SERVICE_ROLE_KEY` — confirmed (set via commit `e2e5cb8`)
- `NEXT_PUBLIC_APP_URL` — should be `https://fsops.netlify.app`, NOT localhost
- `ANTHROPIC_API_KEY` — required for the AI import chat + `/admin/diagnostics` + Suggest-with-AI; may not be set yet
- Sentry / Resend vars — optional; leave blank until those are wired

### 2. Confirm Supabase Auth dashboard config
At [Authentication → URL Configuration](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/url-configuration):
- **Site URL** should be `https://fsops.netlify.app`
- **Redirect URLs** should include:
  - `http://localhost:3000/**` (for local dev)
  - `https://fsops.netlify.app/**` (for prod)
  - any Netlify deploy preview pattern if you use PR previews

At [Authentication → Providers](https://supabase.com/dashboard/project/ztikdgsygcisalbnqpjh/auth/providers):
- Confirm **Email** provider is enabled (magic link + password)

If sign-in works against `fsops.netlify.app`, this is already configured.

### 3. Live-site smoke test (use the deployed site)
Walk through these on `https://fsops.netlify.app` as needed:
- Visit `https://fsops.netlify.app` → redirected to `/login`
- Sign in via magic link as `farisosmanbhoy01@gmail.com` (bootstrap admin, level 3)
- Verify each module:
  - `/admin/users` — invite a second test user at **Level 1 (Editor)**; sign in incognito
  - `/clients/new` — create a test client; edit Important info; add a contact + subcontractor
  - As Level 1: open the client, confirm no edit buttons, file a request change
  - As Level 3: find the auto-created change-request task at `/tasks` (filter by Type = Change request), action it, mark Done; verify audit log entry at `/admin/audit`
  - `/tasks/new` — create a task assigned to yourself; verify it appears on `/` dashboard
  - `/passwords` and `/clients`: click the **Import** button, drop an Excel sheet, walk the chat workspace through a mapping correction, commit; confirm audit log shows the chat transcript
  - `/admin/diagnostics`: run a scan over clients; confirm findings appear and dedupe on a second scan
  - Universal search (Ctrl+K): type a client name → result appears → clicking navigates
  - Notifications bell: assign yourself a task due soon → unread badge → popover lists it
  - Top-nav dropdowns (Company / Administration / Operational) open on click and close on outside-click / Esc / route change
  - Form `<Select>` controls show a visible chevron caret
  - At `xl` viewport: row click on Staff/Clients/Tasks updates the right-hand context panel; below `xl` the right pane is a slideover

### 4. Move auth helpers out of `public` to clear advisor warnings
Three remaining `WARN`s flag that `is_admin()`, `is_manager_or_admin()`, `auth_level()` are SECURITY DEFINER in `public`, so PostgREST exposes them at `/rest/v1/rpc/...` for `authenticated`. They only read the caller's own profile, so risk is low — but the clean fix is:
- Create a new `auth_internal` schema
- Recreate the four helpers in `auth_internal` instead of `public`
- Update all 21 RLS policies to call the schema-qualified `auth_internal.is_admin()` etc.
- Drop the old `public.*` copies

This needs careful sequencing (alter policies before dropping functions, or drop policies + recreate). Plan as a single migration.

### 5. Finish the remaining stub pages
These still render an `EmptyState` (verified at HEAD):
- **`/company/profile`** — needs a `company_profile` table + editable form
- **`/admin/reports`** — saved queries / scheduled exports; no DB or API yet
- **`/admin/suggestions`** — paired with the "Suggestions & Feedback" dashboard card; lightweight inbox
- **`/admin/training`** — training modules + completion tracking per staff member
- **Dashboard "Polls" card** — `ComingSoonCard` with no backing route or table
- **Dynamic breadcrumb labels** — show truncated UUIDs for `/clients/[id]` / `/suppliers/[id]` / `/tasks/[id]`; needs server-rendered or context-fed labels

### 6. (Optional) Wire Sentry DSN
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

- **Netlify MCP** — connected. Used for env-var management on `fsops` (e.g. `SUPABASE_SERVICE_ROLE_KEY` set via commit `e2e5cb8`). `netlify.toml` unchanged; pushes to `main` auto-deploy to `fsops.netlify.app`.
- **Supabase MCP** — connected and used during scaffolding, the redesign, the access-level migration, and the AI-assist migration. Database is in sync with on-disk migrations through `0017`.
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
- **Pre-existing lint errors**: `npm run lint` reports 6 errors across 4 files — `app/(app)/page.tsx:127` (`react-hooks/purity` — impure call during render), `components/CommandPalette.tsx:38,56` (`set-state-in-effect`), `components/NotificationsPopover.tsx:25,40` (`set-state-in-effect`), `components/ui/Modal.tsx:21` (`set-state-in-effect`). All pre-date the AI/import work; cleanup pass when convenient.

---

## 📁 Where things live

```
flipside-ops/
├── app/
│   ├── (auth)/                  ← login, forgot-password, reset-password (brand gradient layout)
│   ├── (app)/                   ← all authenticated pages (shell: TopHeader + MainNav + PageShell)
│   │   ├── page.tsx             ← home dashboard (PROPS sidebar + tabbed hero card + bottom widgets)
│   │   ├── (company)/           ← staff/, me/, company/profile/
│   │   ├── (administration)/    ← tasks/, passwords/, manuals/, admin/{users,config,audit,reports,suggestions,training}/
│   │   └── (operational)/       ← clients/ (incl. change-requests/ actions), suppliers/
│   ├── api/
│   │   ├── admin/               ← invite + level-set endpoints (service-role)
│   │   ├── search/              ← universal search endpoint (CommandPalette)
│   │   └── notifications/       ← bell popover endpoint
│   └── auth/callback/route.ts   ← Supabase magic-link callback
├── components/
│   ├── ui/                      ← shared primitives + DataTable + Pill `dot` variant
│   ├── nav/                     ← TopHeader, MainNav (click-toggle + hamburger), Breadcrumbs, PageShell, nav-items
│   ├── layout/                  ← ThreePaneLayout, ContextPanel
│   ├── dashboard/               ← BrandCard, ProfileCard, IndustryInfoCard, TasksNoticesCard, AlertRibbon
│   ├── clients/                 ← ClientsFilters, ClientsListClient, AssignedPMPicker, SectionBodyEditor, …
│   ├── suppliers/               ← SuppliersFilters, SuppliersListClient, SupplierAssignedPMPicker, …
│   ├── tasks/                   ← TasksFilters, TasksListClient, TaskForm, CommentsThread
│   ├── staff/                   ← StaffFilters, StaffListClient, ProfileEditForm, ChangeMyPasswordCard
│   ├── admin/                   ← AdminUsersListClient, UserContextPanel, AuditListClient, InviteUserButton, SetPasswordButton, LookupEditor
│   ├── import/                  ← ImportButton, ImportChat (split-pane chat workspace), PreviewTable (per-domain table w/ AI-assumption badges), SuggestFieldButton, columns.ts
│   ├── CommandPalette.tsx, RealtimeRefresh.tsx, NotificationsPopover.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── access.ts                ← AccessLevel, SessionProfile, LEVEL_LABELS, isAdmin/canManage/hasLevel (browser-safe)
│   ├── auth.ts                  ← server-only: getSession, requireLevel (re-exports from access.ts)
│   ├── email/resend.ts          ← Resend client (no-op until key set)
│   ├── validators/              ← shared Zod schemas
│   ├── notifications.ts         ← bell data source
│   ├── format.ts                ← date/freshness/cn helpers
│   ├── database.types.ts        ← hand-rolled DB types (access_level / required_level)
│   ├── ai/                      ← _client-core (Anthropic wrapper), client.ts (server-only guard), models.ts, redact.ts (secret stripping incl. mapping-aware), usage.ts, prompts/{importChat,scanDiagnostics,suggestField}.ts
│   └── import/                  ← parser.ts (xlsx/csv), schemas.ts (per-domain columns + Zod row schema), planState.ts (Zod PlanState/TargetPlan/FkLink), applyPlan.ts (pure PlanState→resolved rows), resolveLookups.ts (fuzzy match), crossDomainCommit.ts (topo-sort + FK wiring), actions.ts (server actions: parse, chat turn, accept cross-domain, commit)
├── proxy.ts                     ← Next 16 proxy (session refresh)
├── instrumentation.ts           ← Sentry init entrypoint
├── sentry.{client,server,edge}.config.ts
├── scripts/                     ← smoke-admin (invites), smoke-ai (Anthropic round-trip),
│                                  smoke-import (parser + applyPlan + chat turn against Sonnet),
│                                  smoke-diagnostics (scanner). Run via `npm run smoke:*`.
├── supabase/migrations/         ← 0001..0009, 0011..0017 (15 files; 0010 intentionally skipped)
├── public/brand/                ← logo.jpg, favicon.jpg
├── README.md                    ← engineering setup + access-level + handoff docs
├── USER_GUIDE.md                ← end-user handbook: navigation map + SOPs + glossary
└── NEXT_STEPS.md                ← this file
```

`netlify.toml` lives at the *repo* root (one level above `flipside-ops/`).

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
