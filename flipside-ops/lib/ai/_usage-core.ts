// Pure logic for writing ai_usage_log rows. See ./usage.ts for the
// server-only guarded entry point that app code should use.

import { createClient } from "@supabase/supabase-js";

import type { ModelId } from "./models";

export type UsageEndpoint =
  | "import.chat"
  | "cleanup.suggest"
  | "diagnostics.scan"
  | "smoke";

type LogArgs = {
  userId: string | null;
  endpoint: UsageEndpoint;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

// Service-role insert so RLS doesn't block. Failures are swallowed and logged
// — losing an audit line should never break the user's request.
export async function logUsage(args: LogArgs): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("[ai/usage] Supabase env not set; skipping log");
      return;
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from("ai_usage_log").insert({
      user_id: args.userId,
      endpoint: args.endpoint,
      model: args.model,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cost_usd: args.costUsd,
    });
    if (error) {
      console.error("[ai/usage] log failed", error);
    }
  } catch (e) {
    console.error("[ai/usage] log threw", e);
  }
}
