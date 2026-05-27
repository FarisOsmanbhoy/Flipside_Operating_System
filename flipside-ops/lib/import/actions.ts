"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireLevel } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

import { complete, AIBadOutput, AIServiceUnavailable } from "@/lib/ai/client";
import { HAIKU, SONNET } from "@/lib/ai/models";
import {
  buildMapColumnsUser,
  mapColumnsOutputSchema,
  mapColumnsSystem,
  type MapColumnsOutput,
} from "@/lib/ai/prompts/mapColumns";
import {
  buildClarifyUser,
  clarifyOutputSchema,
  clarifySystem,
  type ClarifyOutput,
} from "@/lib/ai/prompts/clarifyMapping";
import { redactRows } from "@/lib/ai/redact";
import { logUsage } from "@/lib/ai/usage";

import { parseSpreadsheet, ParseError } from "./parser";
import { resolveLookups, type LookupColumnResult } from "./resolveLookups";
import {
  getImportSchema,
  type ImportDomain,
  type ImportSchema,
} from "./schemas";

// ─────────────────────────────────────────────────────────────────────
// 1. parseSpreadsheet — upload → parsed rows
// ─────────────────────────────────────────────────────────────────────
export type ParseResult = {
  ok: true;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
} | {
  ok: false;
  error: string;
};

export async function importParseSpreadsheet(
  domain: ImportDomain,
  formData: FormData,
): Promise<ParseResult> {
  await requireLevel(3);
  getImportSchema(domain); // throws on unknown domain

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file uploaded." };
  }

  try {
    const buffer = await file.arrayBuffer();
    const parsed = await parseSpreadsheet(file.name, file.type, buffer);
    return {
      ok: true,
      headers: parsed.headers,
      rows: parsed.rows,
      totalRows: parsed.totalRows,
      sampleRows: parsed.sampleRows,
    };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: `Failed to parse file: ${(e as Error).message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 2. proposeMapping — AI column mapping (Haiku)
// ─────────────────────────────────────────────────────────────────────
export type ProposeMappingResult =
  | { ok: true; aiUsed: true; data: MapColumnsOutput; costUsd: number }
  | { ok: true; aiUsed: false; data: MapColumnsOutput }
  | { ok: false; error: string };

const ProposeArgsSchema = z.object({
  domain: z.enum(["passwords", "clients", "suppliers"]),
  headers: z.array(z.string()),
  sampleRows: z.array(z.record(z.string(), z.unknown())).max(5),
});

export async function importProposeMapping(
  rawArgs: z.input<typeof ProposeArgsSchema>,
): Promise<ProposeMappingResult> {
  const profile = await requireLevel(3);
  const parsed = ProposeArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: "Invalid arguments to proposeMapping." };
  }
  const { domain, headers, sampleRows } = parsed.data;
  const schema = getImportSchema(domain);

  // Redact secrets before they leave the server.
  const safeSample = redactRows(sampleRows, domain);

  // Manual-mode fallback: produce an empty proposal so the wizard can drive
  // the UI mapping manually. (Returned as aiUsed: false.)
  const manualFallback = (): MapColumnsOutput => ({
    mapping: headers.map((h) => ({
      excelHeader: h,
      dbColumn: guessByName(h, schema),
      confidence: 0,
      reason: "AI service unavailable — manual mapping",
    })),
    unmappedConcerns: [],
  });

  try {
    const res = await complete({
      model: HAIKU,
      system: mapColumnsSystem,
      user: buildMapColumnsUser({
        targetSchema: schema.columns.map((c) => ({
          column: c.column,
          description: c.description,
          required: c.required,
        })),
        excelHeaders: headers,
        sampleRows: safeSample,
      }),
      outputSchema: mapColumnsOutputSchema,
      maxTokens: 1500,
    });

    await logUsage({
      userId: profile.id,
      endpoint: "import.map",
      model: HAIKU,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: res.costUsd,
    });

    return { ok: true, aiUsed: true, data: res.data, costUsd: res.costUsd };
  } catch (e) {
    if (e instanceof AIServiceUnavailable) {
      return { ok: true, aiUsed: false, data: manualFallback() };
    }
    if (e instanceof AIBadOutput) {
      console.error("[import] AI returned bad output:", e.message, "\nRaw:", e.raw);
      return { ok: true, aiUsed: false, data: manualFallback() };
    }
    console.error("[import] proposeMapping failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

// Cheap name-based heuristic for the no-AI fallback. Matches header text
// (normalised) against column names and a few common synonyms.
function guessByName(header: string, schema: ImportSchema): string | null {
  const n = header.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const synonyms: Record<string, string> = {
    name: "name",
    "company name": "name",
    "client name": "name",
    "supplier name": "name",
    system: "system",
    service: "system",
    category: "category_id",
    cat: "category_id",
    type: "type_id",
    status: "status_id",
    location: "location",
    city: "location",
    address: "location",
    username: "username",
    user: "username",
    login: "username",
    email: "username",
    password: "password",
    pword: "password",
    pwd: "password",
    pw: "password",
    url: "web_address",
    "web address": "web_address",
    website: "web_address",
    link: "web_address",
    notes: "notes",
    note: "notes",
    "further info": "further_info",
    "additional info": "further_info",
    department: "dept_id",
    dept: "dept_id",
    pm: "assigned_pm_id",
    "project manager": "assigned_pm_id",
    "account manager": "assigned_pm_id",
    owner: "assigned_pm_id",
    "since date": "since_date",
    since: "since_date",
    "start date": "since_date",
    "important info": "important_info",
  };
  const candidate = synonyms[n];
  if (candidate && schema.columns.some((c) => c.column === candidate)) return candidate;
  // direct match against column name
  const direct = schema.columns.find((c) => c.column === n);
  return direct?.column ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// 3. clarifyMapping — chat turn (Sonnet)
// ─────────────────────────────────────────────────────────────────────
export type ClarifyResult =
  | { ok: true; data: ClarifyOutput; costUsd: number }
  | { ok: false; error: string };

const ClarifyArgsSchema = z.object({
  domain: z.enum(["passwords", "clients", "suppliers"]),
  mapping: z.array(
    z.object({
      excelHeader: z.string(),
      dbColumn: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
  openMappingQuestions: z.array(
    z.object({
      excelHeader: z.string(),
      sampleValues: z.array(z.unknown()),
      reason: z.string(),
    }),
  ),
  openLookupQuestions: z.array(
    z.object({
      dbColumn: z.string(),
      rawValue: z.string(),
      candidates: z.array(z.object({ id: z.string(), label: z.string() })),
      canCreate: z.boolean(),
    }),
  ),
  adminReply: z.string().max(2000).optional(),
  // Maximum 5 turns per import; the wizard tracks turn count and refuses
  // further calls beyond the cap.
  turnNumber: z.number().int().min(1).max(5),
});

export async function importClarifyMapping(
  rawArgs: z.input<typeof ClarifyArgsSchema>,
): Promise<ClarifyResult> {
  const profile = await requireLevel(3);
  const parsed = ClarifyArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: "Invalid arguments to clarifyMapping." };
  }
  const { domain, mapping, openMappingQuestions, openLookupQuestions, adminReply } = parsed.data;
  const schema = getImportSchema(domain);

  const userText = [
    buildClarifyUser({
      targetColumns: schema.columns,
      currentMapping: mapping,
      openMappingQuestions,
      openLookupQuestions,
    }),
    adminReply ? `\nADMIN REPLY:\n${adminReply}` : "",
  ].join("\n");

  try {
    const res = await complete({
      model: SONNET,
      system:
        clarifySystem +
        "\n\nReturn ONLY valid JSON matching the requested schema. No prose, no markdown, no code fences.",
      user: userText,
      outputSchema: clarifyOutputSchema,
      maxTokens: 1200,
    });

    await logUsage({
      userId: profile.id,
      endpoint: "import.clarify",
      model: SONNET,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: res.costUsd,
    });

    return { ok: true, data: res.data, costUsd: res.costUsd };
  } catch (e) {
    if (e instanceof AIServiceUnavailable) {
      return { ok: false, error: "AI service unavailable — proceed manually." };
    }
    console.error("[import] clarifyMapping failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. resolveLookupsForRows — call before preview (no AI; used by wizard)
// ─────────────────────────────────────────────────────────────────────
export type LookupResultDTO = {
  column: string;
  table: string;
  values: {
    rawValue: string;
    match: { id: string; label: string } | null;
    candidates: { id: string; label: string }[];
    canCreate: boolean;
  }[];
};

const ResolveLookupsSchema = z.object({
  domain: z.enum(["passwords", "clients", "suppliers"]),
  mapping: z.array(
    z.object({
      excelHeader: z.string(),
      dbColumn: z.string(),
    }),
  ),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export async function importResolveLookups(
  rawArgs: z.input<typeof ResolveLookupsSchema>,
): Promise<{ ok: true; results: LookupResultDTO[] } | { ok: false; error: string }> {
  await requireLevel(3);
  const parsed = ResolveLookupsSchema.safeParse(rawArgs);
  if (!parsed.success) return { ok: false, error: "Invalid arguments." };

  const schema = getImportSchema(parsed.data.domain);
  try {
    const supabase = await createServiceClient();
    const results = await resolveLookups({
      supabase,
      schema,
      mapping: parsed.data.mapping,
      rows: parsed.data.rows,
    });
    return { ok: true, results: results.map(serializeLookupResult) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function serializeLookupResult(r: LookupColumnResult): LookupResultDTO {
  return {
    column: r.column,
    table: r.table,
    values: Array.from(r.values.values()).map((v) => ({
      rawValue: v.rawValue,
      match: v.match,
      candidates: v.candidates,
      canCreate: v.canCreate,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 5. commitImport — final validate + insert
// ─────────────────────────────────────────────────────────────────────
export type CommitResult =
  | {
      ok: true;
      inserted: number;
      failed: { row: number; reason: string }[];
    }
  | { ok: false; error: string };

const CommitArgsSchema = z.object({
  domain: z.enum(["passwords", "clients", "suppliers"]),
  // Resolved rows already keyed by DB column name, with lookups replaced by
  // their resolved uuids. Anything still string-keyed by Excel header is a
  // wizard bug.
  rows: z.array(z.record(z.string(), z.unknown())),
  // Optional new lookup rows to create before insert, e.g.
  //   [{ table: 'client_types', label: 'Quantity Surveyor' }]
  // commitImport inserts these first (in single statements) so the row inserts
  // can reference them by id. We patch the matching rows by replacing the
  // sentinel "__create__:<label>" with the new uuid.
  newLookups: z
    .array(
      z.object({
        table: z.string(),
        labelColumn: z.string(),
        label: z.string(),
        // Which dbColumn on the imported rows should be patched to the new id?
        column: z.string(),
      }),
    )
    .default([]),
});

export async function importCommit(
  rawArgs: z.input<typeof CommitArgsSchema>,
): Promise<CommitResult> {
  const profile = await requireLevel(3);
  const parsed = CommitArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: "Invalid arguments to commit." };
  }
  const { domain, rows, newLookups } = parsed.data;
  const schema = getImportSchema(domain);

  if (rows.length === 0) {
    return { ok: false, error: "No rows to import." };
  }

  const supabase = await createServiceClient();

  // 1. Create any new lookup rows and patch the row payloads.
  const patchedRows = rows.map((r) => ({ ...r }));
  for (const nl of newLookups) {
    const sentinel = `__create__:${nl.label}`;
    const { data, error } = await supabase
      .from(nl.table)
      .insert({ [nl.labelColumn]: nl.label, created_by: profile.id, updated_by: profile.id })
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: `Failed to create new ${nl.table} row "${nl.label}": ${error?.message ?? "no data"}`,
      };
    }
    for (const row of patchedRows) {
      if (row[nl.column] === sentinel) row[nl.column] = data.id;
    }
  }

  // 2. Validate every row with the per-domain Zod schema.
  const failed: { row: number; reason: string }[] = [];
  const validated: Record<string, unknown>[] = [];
  rows.forEach((row, idx) => {
    const patched = patchedRows[idx];
    const result = schema.rowSchema.safeParse(patched);
    if (!result.success) {
      failed.push({ row: idx + 1, reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      return;
    }
    validated.push(result.data as Record<string, unknown>);
  });

  if (validated.length === 0) {
    return {
      ok: true,
      inserted: 0,
      failed,
    };
  }

  // 3. Insert in a single batch. If the batch fails wholesale, report and stop.
  // Audit triggers fire row-by-row at the DB level, so no extra audit code here.
  const { error } = await supabase.from(schema.tableName).insert(validated);
  if (error) {
    return {
      ok: false,
      error: `Insert failed: ${error.message}`,
    };
  }

  revalidatePath(schema.routePath);

  return {
    ok: true,
    inserted: validated.length,
    failed,
  };
}
