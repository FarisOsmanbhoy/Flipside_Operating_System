# Next Steps — FlipSide Ops

Living checklist. Update as items are completed so a fresh terminal / fresh
Claude session can pick up exactly where the previous one left off.

**Project root:** `C:\Users\osman\Documents\2. Projects\Flipside\FLIPSIDE OPERATING SYSTEM\flipside-ops`
**Supabase project ref:** `ztikdgsygcisalbnqpjh`
**GitHub repo (public):** `https://github.com/FarisOsmanbhoy/Flipside_Operating_System` — `main` at commit `7d3d1c1`
**Bootstrap admin email** (auto-seeded on first sign-in): `farisosmanbhoy01@gmail.com`
**Spec source of truth:** Notion page "FlipSide Internal Ops Tool — Design Spec (v1)" (id `36486ce8-4d64-811f-9056-c8f072052e01`)

---

## ✅ Done

- Scaffolded Next.js 16 + Tailwind v4 + TypeScript at `flipside-ops/` (21 base routes + 2 new API routes = 23)
- Brand theme: teal `#005470` primary, lime `#c2d500` accent, DM Sans + Josefin Sans
- 9 Supabase migrations on disk (`0001`..`0009`); **all applied live** to `ztikdgsygcisalbnqpjh` via MCP
- Auth flow: login (password + magic link), forgot, reset, callback
- App shell: TopNav with **universal search (Ctrl+K)** + **notifications popover** + avatar dropdown
- All 3 v1 modules: Staff, Clients (sections + contacts + subs + request-change + approval queue), Tasks (tabs + new + detail + comments + recurring conversion)
- Home dashboard: stat cards, my tasks, notices, recent activity, realtime refresh
- Admin pages: `/admin/{users,config,audit}` with invite via Supabase Admin API
- Shared UI primitives: Button, Card, Pill, Modal, Accordion, InlineEdit, Avatar, StalenessBadge, EmptyState, Toast, Input/Label/Select/Textarea
- `npm run build` passes cleanly (TypeScript clean, all 23 routes compile)
- Sentry instrumentation wired in `instrumentation.ts` + `sentry.{client,server,edge}.config.ts` (no-op until DSN set)
- `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `netlify.toml` at repo root (base = `flipside-ops`, `@netlify/plugin-nextjs`)
- README rewritten with setup walkthrough + admin handoff docs
- Security advisors clean except 1 stylistic WARN (`pg_trgm` in `public` schema — used by index, low priority)
- Logo + favicon downloaded from flipsidespecialties.com to `public/brand/`
- Pushed 2 commits to `origin/main`
- **PROPS-style redesign** (theme preserved, blue/teal + DM Sans/Josefin Sans untouched):
  - New app shell: `TopHeader` (logo + search icon + bell + avatar) + `MainNav` (horizontal hover-dropdown nav grouped Home / Company / Administration / Operational) + `Breadcrumbs` + `PageShell`. Replaces the old flat `TopNav`. See `components/nav/{TopHeader,MainNav,Breadcrumbs,PageShell,nav-items}.tsx`.
  - Universal search → `CommandPalette` (`Cmd/Ctrl+K` or header search icon). Old always-visible search box removed. See `components/CommandPalette.tsx`.
  - Routes reorganized into Next.js **route groups** (`(company)`, `(administration)`, `(operational)`) for easier mapping — URLs unchanged. See `app/(app)/(company)/{staff,me,company}`, `app/(app)/(administration)/{tasks,admin}`, `app/(app)/(operational)/clients`.
  - List-page **left filter rail** on `/staff` and `/tasks` via new `ListPageLayout`. `StaffFilters` now renders vertically; new `TasksFilters` adds search + "assigned to me" toggle. `/clients` left as-is per spec.
  - Dashboard restyled into PROPS-style grid: tabbed `TasksNoticesCard` (My Tasks / Notices / Activity) + three `ComingSoonCard` placeholders (Suggestions & Feedback, Training, Polls).
  - Stub pages added for `/company/profile`, `/admin/reports`, `/admin/suggestions`, `/admin/training`.
  - Old `components/TopNav.tsx` and `components/UniversalSearch.tsx` deleted.
  - `npm run build` passes (26 routes compile clean).

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
- `handle_new_auth_user` trigger creates profile with `admin` role
- Land on `/` dashboard

Verify each module:
- `/admin/users` — invite a second test user as `editor`; sign in incognito
- `/clients/new` — create a test client; edit Important info; add a contact + subcontractor
- As editor: open the client, confirm no edit buttons, file a request change
- As admin: approve at `/clients/changes`; verify audit log entry at `/admin/audit`
- `/tasks/new` — create a task assigned to yourself; verify it appears on `/` dashboard
- Universal search (Ctrl+K): type a client name → result appears → clicking navigates
- Notifications bell: assign yourself a task due soon → unread badge → popover lists it

### 5. PROPS redesign — finish the placeholders
The redesign shipped stubs that need real implementations. Each is a single page rendering an `EmptyState` with a "Coming soon" pill.
- **`/company/profile`** (`app/(app)/(company)/company/profile/page.tsx`) — needs a data model (likely a single-row `company_profile` table) and an editable form (legal name, addresses, certifications, etc.).
- **`/admin/reports`** (`app/(app)/(administration)/admin/reports/page.tsx`) — saved queries / scheduled exports; nothing exists in DB or API yet.
- **`/admin/suggestions`** (`app/(app)/(administration)/admin/suggestions/page.tsx`) — paired with the "Suggestions & Feedback" dashboard card. Lightweight feedback inbox.
- **`/admin/training`** (`app/(app)/(administration)/admin/training/page.tsx`) — training modules + completion tracking per staff member.
- **Dashboard "Polls" card** — currently a `ComingSoonCard`. No backing route or table.
- **Mobile nav behavior** — the new `MainNav` is horizontally scrollable on narrow screens but lacks a dedicated hamburger / mobile drawer. Acceptable for v1; consider a proper mobile menu later.
- **Dynamic breadcrumb labels** — `Breadcrumbs` shows truncated UUIDs for dynamic segments like `/clients/[id]` and `/tasks/[id]`. To show the real name, breadcrumbs would need to be server-rendered or fed via params/context — deferred.

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

State of MCP / external auths after the PROPS redesign work:

- **Netlify MCP** — still not connected (pre-existing; see Pending #1). The redesign did not touch deploy config. `netlify.toml` is unchanged, the new pages compile clean, so once Netlify is connected the redesign will deploy as-is.
- **Supabase MCP** — connected and used during earlier scaffolding. The redesign made **no DB or RLS changes**; no migrations need applying.
- **No new env vars** were introduced by the redesign. `.env.local` does not need updating, and Netlify env vars (when configured) do not need additions.
- **No new third-party services** were added (no analytics, feature flags, etc.). The only client-side dependencies used are already in `package.json` (`lucide-react`, `date-fns`, etc.).

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
- **Mobile responsive polish**: tables in `/staff`, `/clients`, `/admin/audit` overflow on small screens; have `overflow-x-auto` wrappers but a card-layout fallback would be nicer.
- **Higher-resolution logo**: `public/brand/logo.jpg` is a 17 KB JPG pulled from WordPress. Replace with vector / higher-res when available.
- **Move `pg_trgm` extension** out of public schema (resolves the one remaining advisor WARN).
- **PR preview deploys**: Netlify supports these automatically — just add the Netlify preview URL pattern to Supabase Redirect URLs.

---

## 📁 Where things live

```
flipside-ops/
├── app/
│   ├── (auth)/                  ← login, forgot-password, reset-password
│   ├── (app)/                   ← all authenticated pages (shell: TopHeader + MainNav + PageShell)
│   │   ├── page.tsx             ← home dashboard
│   │   ├── (company)/           ← route group; URLs unchanged
│   │   │   ├── staff/, me/, company/profile/
│   │   ├── (administration)/    ← route group; URLs unchanged
│   │   │   ├── tasks/, admin/{users,config,audit,reports,suggestions,training}/
│   │   └── (operational)/       ← route group; URLs unchanged
│   │       └── clients/
│   ├── api/
│   │   ├── admin/invite/        ← invite user via Supabase Admin API
│   │   ├── search/              ← universal search endpoint (now used by CommandPalette)
│   │   └── notifications/       ← bell popover endpoint
│   └── auth/callback/route.ts   ← Supabase magic-link callback
├── components/
│   ├── ui/                      ← shared primitives
│   ├── nav/                     ← TopHeader, MainNav, Breadcrumbs, PageShell, nav-items
│   ├── layout/                  ← ListPageLayout
│   ├── dashboard/               ← TasksNoticesCard, ComingSoonCard
│   ├── clients/, tasks/, staff/, admin/
│   ├── CommandPalette.tsx, RealtimeRefresh.tsx, NotificationsPopover.tsx
├── lib/
│   ├── supabase/{server,client,proxy}.ts
│   ├── auth.ts                  ← getSession, requireRole
│   ├── notifications.ts         ← bell data source
│   ├── format.ts                ← date/freshness/cn helpers
│   └── database.types.ts        ← hand-rolled DB types
├── proxy.ts                     ← Next 16 proxy (session refresh)
├── instrumentation.ts           ← Sentry init entrypoint
├── sentry.{client,server,edge}.config.ts
├── supabase/migrations/         ← 0001..0009.sql — apply in order
├── public/brand/                ← logo.jpg, favicon.jpg
├── README.md                    ← full setup walkthrough + handoff docs
└── NEXT_STEPS.md                ← this file
```

`netlify.toml` lives at the *repo* root (one level above `flipside-ops/`).

## 🔑 Conventions

- **Server Components by default.** Add `"use client"` only for interactive bits.
- **Server Actions in `actions.ts`** alongside the route. Always call `getSession()` or `requireRole(...)` at the top.
- **RLS is the gate, UI is the affordance.** Frontend hides edit buttons by role; database refuses unauthorised writes regardless.
- **Soft-configurable lookups** live in DB tables editable at `/admin/config`. Don't hardcode option lists.
- **Audit triggers** are attached at the DB level (migration `0007`). New audited tables need a `trg_audit_<table>` trigger.
- **Tailwind v4** uses CSS-based theme tokens in `app/globals.css` (`@theme { ... }`). No `tailwind.config.ts`.
- **Next.js 16 specifics:**
  - `params` and `searchParams` are `Promise<...>` — always `await`
  - `cookies()` and `headers()` are async — always `await`
  - `middleware.ts` is now `proxy.ts` at the project root
  - Server Functions returning `void` should redirect or revalidate; client-callable ones should return data
