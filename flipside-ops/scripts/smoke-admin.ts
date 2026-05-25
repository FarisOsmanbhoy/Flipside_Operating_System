/**
 * Admin smoke test for FlipSide Ops.
 *
 * Exercises the core "create" path for every admin domain by talking to
 * Supabase the same way the server actions / API routes do — directly via the
 * service-role client. Each step is its own try/catch so one failure doesn't
 * skip the rest. Created rows are tagged with a SMOKE-<ts> prefix and torn
 * down in a finally block.
 *
 * What this does cover:
 *   - DB schema (column names, NOT NULL, FK references)
 *   - Foreign-key targets that the UI relies on (category seeds, etc.)
 *   - The `handle_new_auth_user` trigger + profile-update flow used by invite
 *   - That sign-in works with the configured admin credentials
 *
 * What this does NOT cover:
 *   - The Next.js route handlers themselves (HTTP shell, cookie auth, zod)
 *   - File uploads (manuals) — skipped because synthetic bytes would be a lie
 *   - RLS policies (service-role bypasses RLS by design)
 *
 * Required env (do NOT commit secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMOKE_ADMIN_EMAIL        — an existing level-3 user, e.g. the bootstrap admin
 *   SMOKE_ADMIN_PASSWORD     — that user's password
 *
 * Run:  npm run smoke:admin
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ───── env loader ────────────────────────────────────────────────────
// .env.local is the source of truth for this repo. Parse it directly so this
// script doesn't need a dotenv dependency.
function loadDotEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = need("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = need("SMOKE_ADMIN_EMAIL");
const ADMIN_PASSWORD = need("SMOKE_ADMIN_PASSWORD");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const tag = `SMOKE-${stamp}`;
const testEmail = `smoke+${stamp.toLowerCase()}@example.com`;
const testPassword = "Smoke-Test-Pass-2026!";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ───── result tracking ───────────────────────────────────────────────
type Result = {
  step: string;
  status: "ok" | "fail" | "skip";
  id?: string;
  error?: string;
  note?: string;
};
const results: Result[] = [];

const created: {
  authUserId?: string;
  taskId?: string;
  passwordId?: string;
  clientId?: string;
  supplierId?: string;
  departmentId?: string;
} = {};

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const out = await fn();
    results.push({ step: name, status: "ok" });
    console.log(`  ✓ ${name}`);
    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    results.push({ step: name, status: "fail", error: message });
    console.error(`  ✗ ${name}\n      ${message}`);
    return null;
  }
}

function skip(name: string, note: string) {
  results.push({ step: name, status: "skip", note });
  console.log(`  · ${name}  (skipped — ${note})`);
}

// ───── steps ─────────────────────────────────────────────────────────
async function checkAdminLogin() {
  // Use a throwaway client so we don't disturb the service-role admin client.
  const anon = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  if (!data.user) throw new Error("sign-in returned no user");

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("access_level, is_active")
    .eq("id", data.user.id)
    .single();
  if (pErr) throw new Error(`profile lookup: ${pErr.message}`);
  if ((profile?.access_level ?? 0) < 3)
    throw new Error(`admin user has access_level ${profile?.access_level}, need 3`);
  if (!profile.is_active) throw new Error("admin user is_active = false");
}

async function inviteUser() {
  // Mirrors /api/admin/invite: createUser → generateLink → update profile.
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: `${tag} user` },
  });
  if (error || !data.user) {
    throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
  }
  created.authUserId = data.user.id;

  const { error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

  const { error: updErr } = await admin
    .from("profiles")
    .update({
      full_name: `${tag} user`,
      access_level: 1,
    })
    .eq("id", data.user.id);
  if (updErr) throw new Error(`profile update: ${updErr.message}`);

  return data.user.id;
}

async function addDepartment() {
  // Mirrors addLookup({table: "departments", name})
  const { data, error } = await admin
    .from("departments")
    .insert({ name: `${tag} dept` })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row returned");
  created.departmentId = data.id;
  return data.id;
}

async function addTask() {
  // Mirrors saveTask with type=notice (simplest path — no required FKs).
  const { data, error } = await admin
    .from("tasks")
    .insert({
      type: "notice",
      title: `${tag} notice`,
      description: "smoke test",
      recurrence: "none",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row returned");
  created.taskId = data.id;
  return data.id;
}

async function addPassword() {
  // Mirrors createPassword — need a real password_categories id (FK).
  const { data: cat, error: catErr } = await admin
    .from("password_categories")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (catErr) throw new Error(`category lookup: ${catErr.message}`);
  if (!cat) throw new Error("no password_categories seeded — run migrations");

  const { data, error } = await admin
    .from("passwords")
    .insert({
      category_id: cat.id,
      system: `${tag} system`,
      username: "smoke",
      password: "smoke-pass",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row returned");
  created.passwordId = data.id;
  return data.id;
}

async function addClient() {
  // Mirrors createClientRecord with minimal required fields.
  const { data, error } = await admin
    .from("clients")
    .insert({ name: `${tag} client` })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row returned");
  created.clientId = data.id;
  return data.id;
}

async function addSupplier() {
  // Mirrors createSupplierRecord with minimal required fields.
  const { data, error } = await admin
    .from("suppliers")
    .insert({ name: `${tag} supplier` })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row returned");
  created.supplierId = data.id;
  return data.id;
}

// ───── cleanup ───────────────────────────────────────────────────────
async function cleanup() {
  console.log("\nCleanup:");

  const ops: Array<{ what: string; run: () => Promise<{ error: { message: string } | null }> }> = [
    {
      what: `task ${created.taskId ?? "—"}`,
      run: async () =>
        created.taskId
          ? await admin.from("tasks").delete().eq("id", created.taskId)
          : { error: null },
    },
    {
      what: `password ${created.passwordId ?? "—"}`,
      run: async () =>
        created.passwordId
          ? await admin.from("passwords").delete().eq("id", created.passwordId)
          : { error: null },
    },
    {
      what: `client ${created.clientId ?? "—"}`,
      run: async () =>
        created.clientId
          ? await admin.from("clients").delete().eq("id", created.clientId)
          : { error: null },
    },
    {
      what: `supplier ${created.supplierId ?? "—"}`,
      run: async () =>
        created.supplierId
          ? await admin.from("suppliers").delete().eq("id", created.supplierId)
          : { error: null },
    },
    {
      what: `department ${created.departmentId ?? "—"}`,
      run: async () =>
        created.departmentId
          ? await admin.from("departments").delete().eq("id", created.departmentId)
          : { error: null },
    },
  ];

  for (const { what, run } of ops) {
    try {
      const { error } = await run();
      if (error) console.warn(`  ! ${what}: ${error.message}`);
      else if (!what.endsWith("—")) console.log(`  ✓ ${what}`);
    } catch (e) {
      console.warn(`  ! ${what}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Delete the invited auth user last (profile cascades from auth.users).
  if (created.authUserId) {
    const { error } = await admin.auth.admin.deleteUser(created.authUserId);
    if (error) console.warn(`  ! auth user ${created.authUserId}: ${error.message}`);
    else console.log(`  ✓ auth user ${created.authUserId}`);
  }
}

// ───── main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`FlipSide Ops admin smoke test  [${tag}]\n`);
  console.log(`Supabase:  ${SUPABASE_URL}`);
  console.log(`Admin:     ${ADMIN_EMAIL}\n`);

  console.log("Steps:");
  await step("admin sign-in", checkAdminLogin);
  await step("invite user (auth.admin.createUser + profile update)", inviteUser);
  await step("add department (lookup)", addDepartment);
  await step("add task (type=notice)", addTask);
  await step("add password", addPassword);
  await step("add client", addClient);
  await step("add supplier", addSupplier);
  skip("add manual", "file upload requires real bytes; tested manually");
}

let exitCode = 0;
main()
  .catch((e) => {
    console.error("\nFatal:", e);
    exitCode = 1;
  })
  .finally(async () => {
    await cleanup();

    console.log("\nSummary:");
    const widest = Math.max(...results.map((r) => r.step.length));
    for (const r of results) {
      const icon = r.status === "ok" ? "✓" : r.status === "fail" ? "✗" : "·";
      const tail = r.error ? `  — ${r.error}` : r.note ? `  — ${r.note}` : "";
      console.log(`  ${icon}  ${r.step.padEnd(widest)}${tail}`);
    }

    const failed = results.filter((r) => r.status === "fail").length;
    console.log(
      `\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}`,
    );
    process.exit(exitCode || (failed > 0 ? 1 : 0));
  });
