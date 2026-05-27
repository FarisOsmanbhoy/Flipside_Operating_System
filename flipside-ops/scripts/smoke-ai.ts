/**
 * AI smoke test for FlipSide Ops.
 *
 * Verifies:
 *   1. ANTHROPIC_API_KEY is readable from .env.local
 *   2. The @anthropic-ai/sdk client makes a real call to Claude Haiku
 *   3. Structured (JSON + Zod) output works end-to-end
 *   4. The password redactor strips secret values before they would be sent
 *   5. Writing to ai_usage_log via service-role works
 *
 * Run:  npx tsx scripts/smoke-ai.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ───── env loader (mirrors smoke-admin.ts) ─────────────────────────────
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

need("ANTHROPIC_API_KEY");
need("NEXT_PUBLIC_SUPABASE_URL");
need("SUPABASE_SERVICE_ROLE_KEY");

// ───── tests ───────────────────────────────────────────────────────────
async function main() {
  let failures = 0;
  const log = (ok: boolean, label: string, extra?: string) => {
    const tag = ok ? "PASS" : "FAIL";
    console.log(`[${tag}] ${label}${extra ? "  " + extra : ""}`);
    if (!ok) failures++;
  };

  // ── 1. Redactor (pure function, no network) ─────────────────────────
  try {
    const { redactRow, isSecretHeader } = await import("../lib/ai/redact");
    const row = {
      System: "Microsoft 365",
      Username: "ops@flipside.com",
      Password: "hunter2-very-secret",
      Category: "Email",
    };
    const redacted = redactRow(row, "passwords");
    const passwordRedacted =
      typeof redacted.Password === "string" &&
      redacted.Password.startsWith("<redacted:");
    const systemPreserved = redacted.System === "Microsoft 365";
    const usernameRedacted =
      typeof redacted.Username === "string" &&
      redacted.Username.startsWith("<redacted:");
    log(
      passwordRedacted && usernameRedacted && systemPreserved,
      "redactor: passwords domain strips Password + Username, keeps System",
    );
    log(
      isSecretHeader("Pword") && isSecretHeader("API Key") && !isSecretHeader("System"),
      "redactor: header pattern matcher recognises common secret column names",
    );
  } catch (e) {
    log(false, "redactor: import or run", `(${(e as Error).message})`);
  }

  // ── 2. Anthropic structured call (Haiku) ─────────────────────────────
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const { complete } = await import("../lib/ai/_client-core");
    const { HAIKU } = await import("../lib/ai/models");
    const { z } = await import("zod");

    const schema = z.object({
      sum: z.number(),
      greeting: z.string(),
    });

    const res = await complete({
      model: HAIKU,
      system:
        "You are a test endpoint. Reply with the requested JSON and nothing else.",
      user:
        'Return JSON: { "sum": 2 + 3, "greeting": "hello from flipside ops smoke test" }',
      outputSchema: schema,
      maxTokens: 200,
    });

    cost = res.costUsd;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;

    log(
      res.data.sum === 5,
      "haiku: structured arithmetic call returned sum=5",
      `(${inputTokens} in / ${outputTokens} out, $${cost.toFixed(6)})`,
    );
    log(
      typeof res.data.greeting === "string" && res.data.greeting.length > 0,
      "haiku: greeting field present and string",
    );
  } catch (e) {
    log(false, "haiku call", `(${(e as Error).message})`);
  }

  // ── 3. Usage log write (service role) ───────────────────────────────
  try {
    const { logUsage } = await import("../lib/ai/_usage-core");
    const { HAIKU } = await import("../lib/ai/models");
    await logUsage({
      userId: null,
      endpoint: "smoke",
      model: HAIKU,
      inputTokens,
      outputTokens,
      costUsd: cost,
    });

    // Verify by reading it back via service-role.
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data, error } = await admin
      .from("ai_usage_log")
      .select("id, endpoint, model, cost_usd")
      .eq("endpoint", "smoke")
      .order("created_at", { ascending: false })
      .limit(1);
    log(
      !error && !!data && data.length === 1 && data[0].endpoint === "smoke",
      "ai_usage_log: row inserted + readable via service role",
    );
  } catch (e) {
    log(false, "ai_usage_log write/read", `(${(e as Error).message})`);
  }

  console.log("");
  if (failures > 0) {
    console.error(`${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("All AI smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
