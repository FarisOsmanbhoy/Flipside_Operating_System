"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireLevel } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

import {
  complete,
  AIBadOutput,
  AIServiceUnavailable,
} from "@/lib/ai/client";
import { HAIKU } from "@/lib/ai/models";
import {
  buildScanDiagnosticsUser,
  scanDiagnosticsOutputSchema,
  scanDiagnosticsSystem,
} from "@/lib/ai/prompts/scanDiagnostics";
import {
  buildSuggestFieldUser,
  suggestFieldOutputSchema,
  suggestFieldSystem,
} from "@/lib/ai/prompts/suggestField";
import { logUsage } from "@/lib/ai/usage";
import { getImportSchema, type ImportDomain } from "@/lib/import/schemas";

// Per-scan hard cost cap; if accumulated cost crosses this we stop early.
const SCAN_COST_CAP_USD = 0.2;
const BATCH_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────
// runDiagnostics — scan a domain for findings (chunked)
// ─────────────────────────────────────────────────────────────────────
export type RunDiagnosticsResult =
  | {
      ok: true;
      newFindings: number;
      totalRowsScanned: number;
      costUsd: number;
      stoppedEarly: boolean;
    }
  | { ok: false; error: string };

const RunArgsSchema = z.object({
  // Passwords are excluded from the scanner per the privacy boundary.
  domain: z.enum(["clients", "suppliers"]),
});

export async function runDiagnostics(
  rawArgs: z.input<typeof RunArgsSchema>,
): Promise<RunDiagnosticsResult> {
  const profile = await requireLevel(3);
  const parsed = RunArgsSchema.safeParse(rawArgs);
  if (!parsed.success) return { ok: false, error: "Invalid args." };
  const domain = parsed.data.domain as ImportDomain;
  const schema = getImportSchema(domain);

  const supabase = await createServiceClient();
  const entityType = domain === "clients" ? "client" : "supplier";

  // Fetch all rows. Limit to columns the scanner needs (non-sensitive).
  const { data: rows, error } = await supabase
    .from(schema.tableName)
    .select(
      "id, name, location, since_date, important_info, type_id, status_id, assigned_pm_id",
    )
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) {
    return {
      ok: true,
      newFindings: 0,
      totalRowsScanned: 0,
      costUsd: 0,
      stoppedEarly: false,
    };
  }

  let totalCost = 0;
  let totalNew = 0;
  let stoppedEarly = false;
  let scanned = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (totalCost >= SCAN_COST_CAP_USD) {
      stoppedEarly = true;
      break;
    }
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const res = await complete({
        model: HAIKU,
        system: scanDiagnosticsSystem,
        user: buildScanDiagnosticsUser({
          entityType,
          rows: batch as { id: string; [k: string]: unknown }[],
          schemaColumns: schema.columns.map((c) => ({
            column: c.column,
            description: c.description,
          })),
        }),
        outputSchema: scanDiagnosticsOutputSchema,
        maxTokens: 2000,
      });
      totalCost += res.costUsd;
      scanned += batch.length;

      await logUsage({
        userId: profile.id,
        endpoint: "diagnostics.scan",
        model: HAIKU,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costUsd: res.costUsd,
      });

      // Upsert findings. We can't use Supabase upsert on a generated column,
      // so we insert + ignore duplicate-finding errors from the unique index.
      for (const f of res.data.findings) {
        // Validate entity_id is one of the batch rows (model may hallucinate).
        if (!batch.some((r) => (r as { id: string }).id === f.entity_id)) {
          continue;
        }
        const ins = await supabase.from("ai_diagnostics").insert({
          entity_type: entityType,
          entity_id: f.entity_id,
          issue_type: f.issue_type,
          severity: f.severity,
          suggestion: f.suggestion,
          payload: f.payload ?? null,
          created_by: profile.id,
        });
        if (ins.error) {
          // Unique violation = same open finding already exists; silently skip.
          if (ins.error.code === "23505") continue;
          console.error("[diagnostics] insert failed", ins.error);
          continue;
        }
        totalNew++;
      }
    } catch (e) {
      if (e instanceof AIServiceUnavailable) {
        return { ok: false, error: "AI service unavailable." };
      }
      if (e instanceof AIBadOutput) {
        console.error("[diagnostics] AI returned bad output:", e.message);
        continue;
      }
      console.error("[diagnostics] batch failed", e);
      continue;
    }
  }

  revalidatePath("/admin/diagnostics");

  return {
    ok: true,
    newFindings: totalNew,
    totalRowsScanned: scanned,
    costUsd: totalCost,
    stoppedEarly,
  };
}

// ─────────────────────────────────────────────────────────────────────
// dismissFinding — admin says "not an issue"
// ─────────────────────────────────────────────────────────────────────
export async function dismissFinding(id: string) {
  const profile = await requireLevel(3);
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("ai_diagnostics")
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: profile.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/diagnostics");
}

// ─────────────────────────────────────────────────────────────────────
// markActed — admin took action on the finding
// ─────────────────────────────────────────────────────────────────────
export async function markActed(id: string) {
  await requireLevel(3);
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("ai_diagnostics")
    .update({ acted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/diagnostics");
}

// ─────────────────────────────────────────────────────────────────────
// suggestField — inline "Suggest with AI" for a single row + column
// ─────────────────────────────────────────────────────────────────────
export type SuggestFieldResult =
  | {
      ok: true;
      suggestionId: string | null;
      suggestionLabel: string | null;
      reason: string;
      confidence: number;
      costUsd: number;
    }
  | { ok: false; error: string };

const SuggestArgsSchema = z.object({
  domain: z.enum(["clients", "suppliers", "passwords"]),
  entityId: z.uuid(),
  dbColumn: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// applyFieldSuggestion — admin accepts an AI suggestion, write through
// ─────────────────────────────────────────────────────────────────────
const ApplyArgsSchema = z.object({
  domain: z.enum(["clients", "suppliers", "passwords"]),
  entityId: z.uuid(),
  dbColumn: z.string(),
  valueId: z.string().uuid(),
});

export async function applyFieldSuggestion(
  rawArgs: z.input<typeof ApplyArgsSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireLevel(3);
  const parsed = ApplyArgsSchema.safeParse(rawArgs);
  if (!parsed.success) return { ok: false, error: "Invalid args." };
  const { domain, entityId, dbColumn, valueId } = parsed.data;

  const schema = getImportSchema(domain as ImportDomain);
  const colDef = schema.columns.find((c) => c.column === dbColumn);
  if (!colDef?.lookup)
    return { ok: false, error: `Column ${dbColumn} is not a lookup column.` };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from(schema.tableName)
    .update({ [dbColumn]: valueId })
    .eq("id", entityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(schema.routePath);
  revalidatePath(`${schema.routePath}/${entityId}`);
  return { ok: true };
}

export async function suggestField(
  rawArgs: z.input<typeof SuggestArgsSchema>,
): Promise<SuggestFieldResult> {
  const profile = await requireLevel(3);
  const parsed = SuggestArgsSchema.safeParse(rawArgs);
  if (!parsed.success) return { ok: false, error: "Invalid args." };
  const { domain, entityId, dbColumn } = parsed.data;

  const schema = getImportSchema(domain as ImportDomain);
  const colDef = schema.columns.find((c) => c.column === dbColumn);
  if (!colDef) return { ok: false, error: `Unknown column: ${dbColumn}` };
  if (!colDef.lookup)
    return { ok: false, error: `Column ${dbColumn} is not a lookup column.` };

  const supabase = await createServiceClient();

  // Fetch the row's context. Strip sensitive columns for passwords.
  const safeColumnList =
    domain === "passwords"
      ? "id, system, category_id, web_address, dept_id"
      : "id, name, location, since_date, important_info, type_id, status_id";
  const rowRes = await supabase
    .from(schema.tableName)
    .select(safeColumnList)
    .eq("id", entityId)
    .single();
  const row = rowRes.data as unknown as Record<string, unknown> | null;
  if (rowRes.error || !row) {
    return { ok: false, error: rowRes.error?.message ?? "Row not found." };
  }

  // Fetch the lookup options.
  const lookup = colDef.lookup;
  const optionsRes = await supabase
    .from(lookup.table)
    .select(`id, ${lookup.labelColumn}`)
    .limit(100);
  const optionsRaw = optionsRes.data as unknown as Record<string, unknown>[] | null;
  const optsErr = optionsRes.error;
  if (optsErr) return { ok: false, error: optsErr.message };
  const options = (optionsRaw ?? []).map((r) => ({
    id: String(r.id),
    label: String(r[lookup.labelColumn] ?? ""),
  }));

  try {
    const res = await complete({
      model: HAIKU,
      system: suggestFieldSystem,
      user: buildSuggestFieldUser({
        entityType: domain.slice(0, -1), // 'clients' -> 'client'
        dbColumn,
        columnDescription: colDef.description,
        row,
        options,
      }),
      outputSchema: suggestFieldOutputSchema,
      maxTokens: 500,
    });
    await logUsage({
      userId: profile.id,
      endpoint: "cleanup.suggest",
      model: HAIKU,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: res.costUsd,
    });

    // Validate the suggestion id is one we sent (no hallucinated UUIDs).
    if (
      res.data.suggestion_id &&
      !options.some((o) => o.id === res.data.suggestion_id)
    ) {
      return {
        ok: true,
        suggestionId: null,
        suggestionLabel: null,
        reason: `AI suggested an unknown id (${res.data.suggestion_id}); ignored.`,
        confidence: 0,
        costUsd: res.costUsd,
      };
    }

    return {
      ok: true,
      suggestionId: res.data.suggestion_id,
      suggestionLabel: res.data.suggestion_label,
      reason: res.data.reason,
      confidence: res.data.confidence,
      costUsd: res.costUsd,
    };
  } catch (e) {
    if (e instanceof AIServiceUnavailable) {
      return { ok: false, error: "AI service unavailable." };
    }
    return { ok: false, error: (e as Error).message };
  }
}
