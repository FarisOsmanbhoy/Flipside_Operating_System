# FlipSide Ops — User Guide

A handbook for everyone who uses the FlipSide internal operations tool.

- **Part 1 (For everyone)** covers what every staff member needs: signing in, navigating, working with clients/tasks/passwords.
- **Part 2 (For admins)** covers Level 3-only workflows: inviting users, managing configs, approving change requests, audit log.

> _Screenshot placeholders are written as `_Screenshot: <description>_`. Drop the real images in later — the guide reads sensibly without them._

---

## Welcome

FlipSide Ops is the internal source of truth for FlipSide Specialties. It holds:

- **Staff directory** — every team member's profile, contact details, department
- **Clients & Suppliers** — knowledge base per company: sections, contacts, subcontractors (clients only)
- **Tasks & Notices** — assigned work, deadlines, recurring schedules, change requests
- **Passwords vault** — shared credentials organised by category
- **Manuals & Guides** — internal documentation library
- **Administration** — user management, audit log, soft-configurable lookups (admin-only)

### The three access levels

Every account has an **access level** between 1 and 3. Your level decides which menus you see and which actions you can take.

| Level | Label | Can do |
|---|---|---|
| **3** | Admin | Everything: invite users, change levels, edit lookups, approve change requests, view audit log |
| **2** | Manager | Edit clients, suppliers, tasks; cannot enter `/admin/*` |
| **1** | Editor | View most data; file change requests; manage their own profile and tasks assigned to them |

The UI hides buttons and menus you can't use — but the database enforces this too, so even a misbehaving browser can't write data above its level.

---

# Part 1 — For everyone

## Getting started

### First sign-in

You'll receive an invite email from FlipSide Ops with a link. Two ways to sign in:

1. **Magic link** (no password needed) — click the link in the email; it'll log you straight in.
2. **Password** — go to `/login`, enter your email + password.

> _Screenshot: login screen with brand gradient background, email + password fields, "Send magic link" button._

If your invite link expired, ask an admin to re-send it, or use `/forgot-password` to get a recovery link.

### Setting / changing your password

1. Click your avatar in the top-right → **My Profile** (or visit `/me`).
2. Scroll to the **Change password** card.
3. Enter your new password twice and click **Save**.
4. You stay signed in — no re-login needed.

> _Screenshot: `/me` page showing the Change password card._

### Editing your profile + avatar

On `/me` you can edit:

- Full name, preferred name, phone number
- Department (picked from the admin-managed list)
- Extension, date of birth, job title, car registration, specialisation
- Avatar — click the avatar circle, pick an image; it uploads to Supabase storage

Click **Save** at the bottom of the form. The change is logged in the audit trail.

### What your access level means in practice

| You'll see this menu item if… | Editor (1) | Manager (2) | Admin (3) |
|---|:---:|:---:|:---:|
| Home, Staff, My Profile, Company Profile | ✅ | ✅ | ✅ |
| Tasks & Notices | ✅ | ✅ | ✅ |
| Passwords, Manuals & Guides | ✅ | ✅ | ✅ |
| Client Data, Supplier Data (read) | ✅ | ✅ | ✅ |
| Edit client / supplier details | — | ✅ | ✅ |
| Reassign client / supplier PM | — | — | ✅ |
| Approve change requests | — | — | ✅ |
| Users, Config, Audit Log | — | — | ✅ |

---

## Navigating the app

### The top nav

The horizontal bar at the top of every page has four groups. Click a group label to open its dropdown; click outside or press **Esc** to close.

> _Screenshot: top nav showing Home / Company / Administration / Operational + search + bell + avatar._

- **Home** (`/`) — your dashboard
- **Company**
  - Staff (`/staff`) — directory of all team members
  - My Profile (`/me`) — your own profile & password
  - Company Profile (`/company/profile`) — *coming soon*
- **Administration**
  - Tasks & Notices (`/tasks`)
  - Passwords (`/passwords`)
  - Manuals & Guides (`/manuals`)
  - Audit Log (`/admin/audit`) — *admin only*
  - Users (`/admin/users`) — *admin only*
  - Config (`/admin/config`) — *admin only*
  - Reports, Suggestions & Feedback, Training — *coming soon*
- **Operational**
  - Client Data (`/clients`)
  - Supplier Data (`/suppliers`)

To the right of the nav: **universal search** (or press **Ctrl + K**), **notifications bell**, and your **avatar menu**.

### The home dashboard

> _Screenshot: home dashboard — left sidebar with brand card + profile card; right side tabbed hero card._

The home page (`/`) shows:

- **Alert ribbon** at the top — appears when something urgent needs your attention (e.g. an overdue task)
- **Left sidebar** — brand card + your profile card (avatar, name, level)
- **Hero card** — tabbed view: **Industry** | **Tasks** | **Notices** | **Activity**, each with a count badge
- **Bottom row** — coming-soon cards (Polls, etc.)

### The three-pane list layout

Pages like Staff, Clients, Suppliers, Tasks, and Users all use the same three-pane layout on wide screens:

> _Screenshot: clients list page in three-pane mode._

- **Left** — filter sidebar (search box, dropdowns to narrow results)
- **Centre** — sortable, selectable data table; click a row to select it
- **Right** — context panel showing details of the selected row + quick actions

On screens narrower than ~1280px (`xl`), the right pane becomes a slideover that appears when you select a row.

---

## Common tasks (For everyone)

### Find a staff member

1. Top nav → **Company → Staff**.
2. Use the filter sidebar on the left to narrow by department or search by name.
3. Click a row to see the profile in the right pane.
4. Click the row's link to open the full profile page (`/staff/[id]`).

### Browse a client (or supplier)

1. Top nav → **Operational → Client Data** (or **Supplier Data**).
2. The list page works exactly the same as Staff: filter left, select a row, details in the right pane.
3. Click into a client to see the full page: **Important info** box, **Sections** (notes / docs / contracts / whatever your admins have configured), **Contacts**, **Subcontractors** (clients only).

> _Screenshot: full client detail page with sections accordion + contacts + subcontractors._

> Suppliers work identically to clients except they have **no Subcontractors** section.

### Create a task or notice

1. Top nav → **Administration → Tasks & Notices**.
2. Click the teal **+ New** button (or visit `/tasks/new`).
3. Fill in: **title**, **type** (task / notice / recurring template), **assignee**, **priority**, **due date**, optional description.
4. Click **Create**.

The new task appears immediately on your dashboard's Tasks tab and the recipient's notifications bell.

### Comment on a task / mark it complete

1. Open the task: `/tasks/[id]`.
2. Scroll to the **Comments** thread at the bottom — type, **Post**.
3. To complete: change the **Status** dropdown to "Done" and **Save**.

### File a change request against a client

If you don't have edit rights on a client (i.e. you're a Level 1 Editor), use the change-request flow to ask an admin to make the edit for you.

1. Open the client at `/clients/[id]`.
2. Click **Request change** (top-right of the section you want to edit).
3. Describe what should change and why. **Submit**.
4. A **task** is created automatically and routed to the client's assigned PM and to admins. You'll be notified when it's actioned.

> Suppliers use the same flow.

### Add a password to the vault

1. Top nav → **Administration → Passwords**.
2. Click **+ Add password** (teal button, top of the list).
3. Fill in: **label**, **category** (pick from the dropdown — admins manage this list at `/admin/config`), **username**, **password**, optional URL and notes.
4. **Save**. The entry appears in the table for everyone with vault access.
5. To copy a password, click the copy icon in the row — it goes straight to your clipboard.

### Browse manuals & guides

1. Top nav → **Administration → Manuals & Guides**.
2. Filter by category in the left sidebar, or search for a title.
3. Click a row to open it.

### Use universal search

Press **Ctrl + K** (or **⌘ + K** on Mac) from anywhere in the app. Start typing — results across staff, clients, suppliers, tasks, and passwords appear. Press **Enter** on a result to navigate to it.

> _Screenshot: command palette open with a few matched results._

### Check notifications

The **bell icon** in the top-right shows a red dot when you have unread notifications. Click it to see the popover — recent task assignments, comments mentioning you, due-soon reminders.

---

# Part 2 — For admins (Level 3)

This section assumes you're signed in as a Level 3 admin and the **Administration** group's admin-only items are visible to you.

## Invite a new user

1. Top nav → **Administration → Users** (`/admin/users`).
2. Click **+ Invite user** (top-right).
3. Enter email + starting access level (default: Level 1 — Editor).
4. **Send invite**. The invitee gets an email with a magic-link sign-in.

> _Screenshot: invite modal with email field + level select._

### When an invite fails

If the invite button shows an error:

- Check that `NEXT_PUBLIC_APP_URL` matches the live Netlify URL (a mismatch breaks the redirect)
- Confirm the email's Supabase Auth quota hasn't been hit (default provider has a low rate limit — see the README about swapping to Resend)
- Run the smoke script for a clean diagnosis:

```sh
cd flipside-ops
npx tsx scripts/smoke-admin.ts <test@example.com>
```

This calls the same Admin API path the UI uses and prints the raw Supabase error.

## Promote / demote a user

1. `/admin/users` → click the user's row.
2. In the right context panel, find the **Access level** field.
3. Click it to inline-edit; pick Level 1 / 2 / 3 from the dropdown.
4. The change is saved instantly and logged to the audit trail.

> Users can't change their own level — the RLS policy on `profiles` blocks it.

## Set a temporary password for a user

If a user can't receive the magic-link email:

1. `/admin/users` → select the user.
2. In the context panel, click **Set password** (button visible to Level 3 only).
3. Enter the temp password twice. **Save**.
4. Share the password through a secure channel and tell them to change it under **My Profile → Change password** after first sign-in.

## Reassign a client's or supplier's PM (Level 3 only)

1. Open the client (`/clients/[id]`) or supplier (`/suppliers/[id]`).
2. In the **Important info** box, click the **Assigned PM** field.
3. Pick a new staff member from the dropdown. **Save**.

Only Level 3 can change the assigned PM. Managers (Level 2) can edit other fields on the client but the PM picker is locked.

## Approve a change request

Change requests are now **tasks** — there's no separate `/clients/changes` page.

1. `/tasks` → filter by **Type = Change request** (or look for the change-request badge in the table).
2. Open the task. The original requester + the affected client/supplier are linked at the top.
3. Make the requested edit on the client/supplier page in another tab, then return to the task.
4. Add a comment summarising what you changed.
5. Set the task status to **Done** and **Save**. The requester is notified.

## Edit soft-configurable lookups

`/admin/config` is the single place for all option lists used across the app. Editing these is non-destructive — existing records keep working.

Categories you can edit:

- **Departments** — used on staff profiles (empty on first install; populate per FlipSide's org chart)
- **Task statuses, priorities, types**
- **Client section types** — and their `required_level` (which level can edit the section)
- **Password categories** — drives the dropdown on `/passwords`
- **Manual categories** — drives the dropdown on `/manuals`

> _Screenshot: `/admin/config` showing the lookup tables in tabs._

To add an entry: click the tab → **+ Add** → fill in label + sort order → **Save**.

## Review the audit log

`/admin/audit` (Level 3) shows every audited change: who, what table, what changed, when. Use the filter sidebar to narrow by table or actor.

> _Screenshot: audit log table with filter sidebar._

Audit entries are written automatically by DB triggers (migration `0007`). New tables that should be audited need a `trg_audit_<table>` trigger — see migration files for the pattern.

## Hand off bootstrap admin to a new owner

1. New owner signs in for the first time (they land at Level 1 — Editor).
2. Current admin: `/admin/users` → select them → set level to **3 — Admin**.
3. Optional: downgrade your own account to Level 1, or have them remove you.

Bootstrap email logic only matters for the *very first* sign-in. After that, level management is entirely UI-driven.

---

## Glossary

- **Access level** — integer 1/2/3 on every profile, controlling what they can see and edit.
- **Admin (Level 3)** — full access including `/admin/*` and PM reassignment.
- **Assigned PM** — the staff member responsible for a client or supplier; only Level 3 can change this.
- **Audit entry** — automatic log row written when a tracked field changes; viewable at `/admin/audit`.
- **Change request** — a Level 1 user asking for an edit they don't have rights to make. Creates a task routed to admins / the assigned PM.
- **Context panel** — the right-hand pane on list pages showing the selected row's details.
- **Editor (Level 1)** — default level for new sign-ins; read-mostly with change-request flow.
- **Lookup** — a soft-configurable option list (statuses, types, categories, …) editable at `/admin/config`.
- **Manager (Level 2)** — can edit clients/suppliers/tasks; cannot reach `/admin/*`.
- **Recurring template** — a task that spawns instances on a schedule (scheduler not yet wired — see NEXT_STEPS).
- **Section** — a labelled chunk of a client/supplier record (notes, contracts, docs, …); the type list is admin-configurable.
- **Subcontractor** — a child company under a client (clients only — suppliers don't have these).
- **Three-pane layout** — the filters / table / context-panel layout used on all list pages.

---

## Troubleshooting / FAQ

**I clicked the magic link and it kicked me back to the login page.**
Magic links expire after a short window (and can only be used once). Visit `/forgot-password` and get a fresh one, or ask an admin for a temp password.

**I can't see the Users / Config / Audit menu items.**
Those are Level 3 only. Ask an admin to check your access level on `/admin/users`.

**I can't edit the Assigned PM on a client.**
That field is locked to Level 3 admins. Use **Request change** to ask one.

**The invite email never arrived.**
Check spam first. If it's truly missing, an admin can run `scripts/smoke-admin.ts` to diagnose, or use **Set password** to give you direct credentials.

**My profile saved and the page crashed.**
This was fixed in commit `553f154`. Hard-refresh (Ctrl + Shift + R) — you're likely on a cached old bundle.

**Universal search isn't finding something I know exists.**
Search currently covers staff / clients / suppliers / tasks / passwords. Manuals and admin lookups are not searched yet.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl + K** / **⌘ + K** | Open universal search |
| **Esc** | Close popover / dropdown / search |
| **Click outside** | Same as Esc |
| **Enter** (in search) | Navigate to highlighted result |
| **Tab / Shift + Tab** | Move between form fields |

---

_Maintained alongside the code. If a screen doesn't match this guide, the code wins — tell whoever's looking after the docs so the guide can be brought back in line._
