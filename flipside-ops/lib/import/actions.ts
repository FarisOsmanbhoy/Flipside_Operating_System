"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireLevel } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

import { complete, AIBadOutput, AIServiceUnavailable } from "@/lib/ai/client";
import { SONNET } from "@/lib/ai/models";
import {
  buildImportChatSystemPrompt,
  buildImportChatUserMessage,
  importChatOutputSchema,
  appendTranscript,
  type ImportChatMutation,
  type ImportChatOutput,
  type LookupCandidatesForTurn,
} from "@/lib/ai/prompts/importChat";
import { redactRowsForChat } from "@/lib/ai/redact";
import { logUsage } from "@/lib/ai/usage";

import { applyPlan } from "./applyPlan";
import { crossDomainCommit } from "./crossDomainCommit";
import { parseSpreadsheet, ParseError } from "./parser";
import { resolveLookups } from "./resolveLookups";
import {
  emptyTargetPlan,
  initialPlanState,
  planStateSchema,
  IMPORT_CHAT_COST_CAP_USD,
  type PlanState,
  type TargetPlan,
} from "./planState";
import { getImportSchema, type ImportDomain } from "./schemas";

// ─────────────────────────────────────────────────────────────────────
// 1. parseSpreadsheet — upload → parsed rows
// ─────────────────────────────────────────────────────────────────────
export type ParseResult =
  | {
      ok: true;
      headers: string[];
      rows: Record<string, unknown>[];
      totalRows: number;
      sampleRows: Record<string, unknown>[];
    }
  | { ok: false; error: string };

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
// 2. importChatTurn — drive the conversation
// ─────────────────────────────────────────────────────────────────────

const ChatTurnArgsSchema = z.object({
  state: planStateSchema,
  userText: z.string().max(2000),
  isFirstTurn: z.boolean(),
});

export type ImportChatTurnResult =
  | {
      ok: true;
      state: PlanState;
      assistantText: string;
      pendingQuestion?: string;
      costUsdThisTurn: number;
    }
  | {
      ok: false;
      error: string;
      // Caller can still display partial results if it has the prior state.
    };

export async function importChatTurn(
  rawArgs: z.input<typeof ChatTurnArgsSchema>,
): Promise<ImportChatTurnResult> {
  const profile = await requireLevel(3);
  const parsed = ChatTurnArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const detail =
      process.env.NODE_ENV !== "production"
        ? ` (${parsed.error.issues
            .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
            .slice(0, 3)
            .join("; ")})`
        : "";
    return { ok: false, error: `Invalid arguments to importChatTurn.${detail}` };
  }
  const { state, userText, isFirstTurn } = parsed.data;

  // Cost cap check before spending more.
  if (state.costUsdSpent >= IMPORT_CHAT_COST_CAP_USD) {
    return {
      ok: false,
      error: `Cost cap of $${IMPORT_CHAT_COST_CAP_USD.toFixed(2)} reached for this chat. Import what you have or start over.`,
    };
  }

  // Compute current resolved state + lookup candidates the AI needs to know about.
  const apply = applyPlan(state);
  const supabase = await createServiceClient();

  const lookupCandidates: LookupCandidatesForTurn = [];
  let cellWarningCount = 0;
  let rowErrorCount = 0;
  for (const t of Object.values(apply.byDomain)) {
    if (!t) continue;
    cellWarningCount += t.cellWarnings.length;
    rowErrorCount += t.rowErrors.length;

    const planForDomain = state.targets[t.domain]!;
    const mappingArr = Object.entries(planForDomain.mappings).map(([excelHeader, dbColumn]) => ({
      excelHeader,
      dbColumn,
    }));
    if (mappingArr.length === 0) continue;

    const results = await resolveLookups({
      supabase,
      schema: t.schema,
      mapping: mappingArr,
      rows: state.sourceRows,
    });
    for (const r of results) {
      for (const v of r.values.values()) {
        const key = `${r.column}::${v.rawValue}`;
        if (planForDomain.lookupChoices[key]) continue; // already resolved by AI
        if (v.match) continue; // exact/prefix match — applyPlan still needs an explicit choice, but the model will likely just emit `resolve_lookup` with kind=existing. Include in the unresolved list so the model knows.
        lookupCandidates.push({
          domain: t.domain,
          dbColumn: r.column,
          rawValue: v.rawValue,
          candidates: v.candidates.slice(0, 20),
          canCreate: v.canCreate,
        });
      }
    }
  }

  // Build the per-turn user message. Sample rows are redacted for the chat —
  // we use mapping-aware redaction on top of the pattern fallback.
  const primaryMappings = state.targets[state.primaryDomain]?.mappings ?? {};
  const sample = redactRowsForChat({
    rows: state.sourceRows.slice(0, 5),
    scope: state.primaryDomain,
    mappings: primaryMappings,
  });

  const systemPrompt = buildImportChatSystemPrompt();
  const userMessage = buildImportChatUserMessage({
    state,
    sampleSourceRows: sample,
    lookupCandidates,
    cellWarningCount,
    rowErrorCount,
    userText,
    isFirstTurn,
  });

  // Call the AI.
  let aiResult: ImportChatOutput;
  let costThisTurn = 0;
  try {
    const res = await complete({
      model: SONNET,
      system: systemPrompt,
      user: userMessage,
      outputSchema: importChatOutputSchema,
      maxTokens: 2000,
    });
    aiResult = res.data;
    costThisTurn = res.costUsd;
    await logUsage({
      userId: profile.id,
      endpoint: "import.chat",
      model: SONNET,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: res.costUsd,
    });
  } catch (e) {
    if (e instanceof AIServiceUnavailable) {
      return {
        ok: false,
        error: "AI service unavailable. Set ANTHROPIC_API_KEY or import manually.",
      };
    }
    if (e instanceof AIBadOutput) {
      console.error("[import.chat] bad output", e.message, e.raw);
      return { ok: false, error: "AI returned malformed output. Try rephrasing." };
    }
    console.error("[import.chat] failed", e);
    return { ok: false, error: (e as Error).message };
  }

  // Apply the mutations.
  const nextState = applyMutations(state, aiResult.mutations);
  nextState.costUsdSpent = state.costUsdSpent + costThisTurn;
  nextState.transcript = appendTranscript(state, userText, {
    text: aiResult.assistantText,
    mutations: aiResult.mutations,
  });
  nextState.version = state.version + 1;

  return {
    ok: true,
    state: nextState,
    assistantText: aiResult.assistantText,
    pendingQuestion: aiResult.pendingQuestion,
    costUsdThisTurn: costThisTurn,
  };
}

// ─── Mutation application ─────────────────────────────────────────────

function applyMutations(state: PlanState, mutations: ImportChatMutation[]): PlanState {
  const next: PlanState = structuredClone(state);

  function ensureTarget(d: ImportDomain): TargetPlan {
    if (!next.targets[d]) next.targets[d] = emptyTargetPlan();
    return next.targets[d]!;
  }

  for (const m of mutations) {
    switch (m.kind) {
      case "set_mapping": {
        const t = ensureTarget(m.domain);
        if (m.dbColumn === "") {
          delete t.mappings[m.excelHeader];
        } else {
          t.mappings[m.excelHeader] = m.dbColumn;
        }
        break;
      }
      case "set_default": {
        const t = ensureTarget(m.domain);
        t.defaults[m.dbColumn] = m.value;
        break;
      }
      case "add_transform": {
        const t = ensureTarget(m.domain);
        t.transforms.push(m.rule);
        break;
      }
      case "resolve_lookup": {
        const t = ensureTarget(m.domain);
        t.lookupChoices[`${m.dbColumn}::${m.rawValue}`] = m.resolution;
        break;
      }
      case "propose_cross_domain_target": {
        // We register the proposal but DON'T add the target yet — the user
        // must accept via a follow-up turn. Surface it as a warning so the UI
        // can render a "Add Clients tab? [Yes / No]" affordance.
        const existing = next.warnings.find(
          (w) =>
            w.source === "ai" &&
            w.severity === "info" &&
            w.message.startsWith(`__propose__:${m.domain}:`),
        );
        if (!existing) {
          next.warnings.push({
            domain: m.domain,
            rowIndex: null,
            column: null,
            severity: "info",
            message: `__propose__:${m.domain}:${JSON.stringify(m.mappings)}:${m.reason}`,
            source: "ai",
          });
        }
        break;
      }
      case "remove_target": {
        if (m.domain === next.primaryDomain) break; // can't remove primary
        delete next.targets[m.domain];
        // Drop links that touch this domain.
        next.links = next.links.filter(
          (l) => l.fromDomain !== m.domain && l.toDomain !== m.domain,
        );
        break;
      }
      case "link_rows": {
        const exists = next.links.some(
          (l) =>
            l.fromDomain === m.fromDomain &&
            l.fromColumn === m.fromColumn &&
            l.toDomain === m.toDomain &&
            l.toLabelColumn === m.toLabelColumn,
        );
        if (!exists) {
          next.links.push({
            fromDomain: m.fromDomain,
            fromColumn: m.fromColumn,
            toDomain: m.toDomain,
            toLabelColumn: m.toLabelColumn,
          });
        }
        break;
      }
      case "set_row_filter": {
        const t = ensureTarget(m.domain);
        t.rowFilter = { sourceColumn: m.sourceColumn, matchAny: m.matchAny };
        break;
      }
      case "clear_row_filter": {
        const t = ensureTarget(m.domain);
        delete t.rowFilter;
        break;
      }
      case "note_warning": {
        next.warnings.push({
          domain: m.domain,
          rowIndex: m.rowIndex,
          column: m.column,
          severity: m.severity,
          message: m.message,
          source: "ai",
        });
        break;
      }
    }
  }

  return next;
}

// ─────────────────────────────────────────────────────────────────────
// 3. importAcceptCrossDomain — turn a proposal into an active target
// ─────────────────────────────────────────────────────────────────────

const AcceptCrossDomainSchema = z.object({
  state: planStateSchema,
  domain: z.enum(["passwords", "clients", "suppliers"]),
});

export async function importAcceptCrossDomainTarget(
  rawArgs: z.input<typeof AcceptCrossDomainSchema>,
): Promise<{ ok: true; state: PlanState } | { ok: false; error: string }> {
  await requireLevel(3);
  const parsed = AcceptCrossDomainSchema.safeParse(rawArgs);
  if (!parsed.success) return { ok: false, error: "Invalid arguments." };
  const { state, domain } = parsed.data;

  const proposal = state.warnings.find(
    (w) =>
      w.source === "ai" &&
      w.severity === "info" &&
      w.message.startsWith(`__propose__:${domain}:`),
  );
  if (!proposal) {
    return { ok: false, error: `No pending proposal for ${domain}.` };
  }

  // Parse the encoded mappings out of the proposal message.
  const remainder = proposal.message.slice(`__propose__:${domain}:`.length);
  const jsonEnd = remainder.lastIndexOf(":");
  const mappingsJson = remainder.slice(0, jsonEnd);
  let mappings: Record<string, string>;
  try {
    mappings = JSON.parse(mappingsJson);
  } catch {
    return { ok: false, error: "Corrupt cross-domain proposal." };
  }

  const next: PlanState = structuredClone(state);
  next.targets[domain] = { ...emptyTargetPlan(), mappings };
  next.warnings = next.warnings.filter((w) => w !== proposal);
  next.version = state.version + 1;
  return { ok: true, state: next };
}

// ─────────────────────────────────────────────────────────────────────
// 4. initialPlanForUpload — produce the starting PlanState
// ─────────────────────────────────────────────────────────────────────

export async function importInitialPlan(args: {
  domain: ImportDomain;
  headers: string[];
  rows: Record<string, unknown>[];
}): Promise<{ ok: true; state: PlanState } | { ok: false; error: string }> {
  await requireLevel(3);
  try {
    getImportSchema(args.domain);
    const state = initialPlanState({
      primaryDomain: args.domain,
      sourceHeaders: args.headers,
      sourceRows: args.rows,
    });
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. importCommit — final commit (wraps crossDomainCommit)
// ─────────────────────────────────────────────────────────────────────

const CommitArgsSchema = z.object({
  state: planStateSchema,
});

export type CommitResult =
  | {
      ok: true;
      insertedByDomain: Partial<Record<ImportDomain, number>>;
      newLookupsCreated: { table: string; label: string; id: string }[];
    }
  | {
      ok: false;
      error: string;
      validationFailures?: { domain: ImportDomain; rowIndex: number; reason: string }[];
      rolledBack?: { table: string; count: number }[];
    };

export async function importCommit(
  rawArgs: z.input<typeof CommitArgsSchema>,
): Promise<CommitResult> {
  const profile = await requireLevel(3);
  const parsed = CommitArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: "Invalid arguments to commit." };
  }
  const { state } = parsed.data;

  const apply = applyPlan(state);
  const supabase = await createServiceClient();

  const result = await crossDomainCommit({ supabase, actorId: profile.id, apply });

  if (result.ok) {
    for (const domain of Object.keys(result.insertedByDomain) as ImportDomain[]) {
      revalidatePath(getImportSchema(domain).routePath);
    }
  }

  return result;
}
