// System prompt + structured output schema for the AI-driven import chat.
//
// We don't use Anthropic's native tool use here. Instead each turn the model
// returns a single JSON object: a chat message for the user, plus an array
// of typed `mutations` to apply to PlanState. This keeps the existing
// `complete()` wrapper, makes mutations replayable, and lets us audit-log
// the exact change set.
//
// The server is in charge of:
//   - Running applyPlan() and feeding the model a summary of the current
//     plan + the warnings/row errors.
//   - Pre-resolving any unmapped lookup values with resolveLookups() and
//     handing the model the candidate matches.
//   - Validating the model's output against `importChatOutputSchema`.

import { z } from "zod";

import {
  IMPORT_CHAT_COST_CAP_USD,
  type ChatMessage,
  type PlanState,
} from "@/lib/import/planState";
import { listImportDomains, getImportSchema } from "@/lib/import/schemas";
import { getImportKnowledgePack } from "./importKnowledge";

// ─── Output schema (the model's response shape) ───────────────────────────

const mutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("set_mapping"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    excelHeader: z.string(),
    dbColumn: z.string(), // pass empty string to unmap
  }),
  z.object({
    kind: z.literal("set_default"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    dbColumn: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.object({
    kind: z.literal("add_transform"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    rule: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("trim"), column: z.string() }),
      z.object({ kind: z.literal("uppercase"), column: z.string() }),
      z.object({ kind: z.literal("lowercase"), column: z.string() }),
      z.object({
        kind: z.literal("split_name"),
        sourceColumn: z.string(),
        firstInto: z.string(),
        lastInto: z.string(),
      }),
      z.object({
        kind: z.literal("regex_extract"),
        sourceColumn: z.string(),
        pattern: z.string(),
        intoColumn: z.string(),
      }),
      z.object({
        kind: z.literal("constant"),
        column: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    ]),
  }),
  z.object({
    kind: z.literal("resolve_lookup"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    dbColumn: z.string(),
    rawValue: z.string(),
    resolution: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("existing"), id: z.uuid() }),
      z.object({ kind: z.literal("create"), label: z.string().min(1) }),
      z.object({ kind: z.literal("skip") }),
    ]),
  }),
  z.object({
    kind: z.literal("propose_cross_domain_target"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    // The model must also propose initial mappings so the user immediately
    // sees a populated preview tab once they accept.
    mappings: z.record(z.string(), z.string()),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("remove_target"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
  }),
  z.object({
    kind: z.literal("link_rows"),
    fromDomain: z.enum(["passwords", "clients", "suppliers"]),
    fromColumn: z.string(),
    toDomain: z.enum(["passwords", "clients", "suppliers"]),
    toLabelColumn: z.string(),
  }),
  z.object({
    kind: z.literal("set_row_filter"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    sourceColumn: z.string(),
    matchAny: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("clear_row_filter"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
  }),
  z.object({
    kind: z.literal("note_warning"),
    domain: z.enum(["passwords", "clients", "suppliers"]),
    rowIndex: z.number().int().nullable(),
    column: z.string().nullable(),
    severity: z.enum(["info", "needs_input"]),
    message: z.string(),
  }),
]);
export type ImportChatMutation = z.infer<typeof mutationSchema>;

export const importChatOutputSchema = z.object({
  assistantText: z.string().min(1).max(2000),
  mutations: z.array(mutationSchema).max(50),
  // Optional question the assistant wants the user to answer next turn.
  // Surfaced as a separate UI hint; if omitted the chat just waits for input.
  pendingQuestion: z.string().max(500).optional(),
});
export type ImportChatOutput = z.infer<typeof importChatOutputSchema>;

// ─── System prompt ────────────────────────────────────────────────────────

export function buildImportChatSystemPrompt(): string {
  const domains = listImportDomains();
  const schemaSummary = domains
    .map((d) => {
      const s = getImportSchema(d);
      const cols = s.columns
        .map((c) => {
          const req = c.required ? " (REQUIRED)" : "";
          const lookup = c.lookup
            ? ` [lookup→${c.lookup.table}.${c.lookup.labelColumn}${c.lookup.allowCreate ? ", can create new" : ""}]`
            : "";
          return `    - ${c.column}${req}${lookup}: ${c.description}`;
        })
        .join("\n");
      return `  ${d} (table: ${s.tableName}):\n${cols}`;
    })
    .join("\n\n");

  return `You are the import assistant for a small operations app. Users upload Excel/CSV sheets and you help land the data in the right tables, even when the sheet is messy or shaped differently than expected.

GROUND RULES
- Never block the user. If a required field has no source column, assign a sensible default ('Unknown', 'General', etc.) and surface it as a note_warning so the user can correct it. Do not refuse to proceed.
- Make assumptions and SHOW them. Use note_warning generously so the user sees what you did. Defaults set via set_default are auto-warned by the resolver — only add note_warning when something needs the user's attention.
- Prefer existing values over creating new ones. Only emit resolve_lookup with kind=create when the user clearly wants a new lookup row (or when allowCreate is true AND no candidate matches).
- Treat secrets (password, username, further_info on the passwords domain) as opaque — they're already redacted in everything you see. Never echo or guess their content.

CROSS-DOMAIN
- The user landed on ONE page (the primary domain). But a single sheet often carries data for other domains too.
- If 3+ columns of the sheet match another domain's schema, propose_cross_domain_target it with initial mappings. Mention this in assistantText and ask if the user wants it imported too. Don't activate it silently — wait for confirmation, then on the next turn you can refine it.
- Use link_rows when a child domain has a foreign-key column that should be wired to a parent domain you're also importing. Example: passwords.client_id ← clients.name. Without link_rows, FK columns insert as null.

OUTPUT
- You MUST return ONLY a single JSON object matching the schema. No prose, no markdown, no code fences.
- assistantText is shown verbatim in the chat. Keep it 1-4 sentences, plain English, no bullet lists unless necessary. Reference what you changed (\"I mapped Vendor Name → name and defaulted status to Active\").
- mutations: a list of changes the system will apply atomically. Empty array is OK (e.g. user just asked a question).
- pendingQuestion: include only when you need the user to answer something specific before progressing.

COST CAP
- This chat has a hard cap of $${IMPORT_CHAT_COST_CAP_USD.toFixed(2)} USD per session. If the user keeps asking for more, finish the current turn and they'll see a cap-reached message.

PRODUCT KNOWLEDGE (excerpts from the live user guide and README — treat as authoritative for behaviour, defaults policy, privacy, and access-level rules)
${getImportKnowledgePack()}

DOMAIN SCHEMAS
${schemaSummary}
`;
}

// ─── Per-turn user message ────────────────────────────────────────────────

export type LookupCandidatesForTurn = {
  domain: "passwords" | "clients" | "suppliers";
  dbColumn: string;
  rawValue: string;
  candidates: { id: string; label: string }[];
  canCreate: boolean;
}[];

export function buildImportChatUserMessage(args: {
  state: PlanState;
  sampleSourceRows: Record<string, unknown>[]; // already redacted
  lookupCandidates: LookupCandidatesForTurn;
  cellWarningCount: number;
  rowErrorCount: number;
  userText: string; // empty string on the first auto-turn
  isFirstTurn: boolean;
}): string {
  const { state, sampleSourceRows, lookupCandidates, cellWarningCount, rowErrorCount, userText, isFirstTurn } = args;

  const activeTargets = Object.keys(state.targets);
  const targetSummary = activeTargets
    .map((d) => {
      const t = state.targets[d as keyof typeof state.targets]!;
      const mapEntries = Object.entries(t.mappings)
        .map(([excel, db]) => `      ${JSON.stringify(excel)} → ${db}`)
        .join("\n");
      const defaults = Object.entries(t.defaults)
        .map(([db, v]) => `      ${db} = ${JSON.stringify(v)}`)
        .join("\n");
      return `  ${d}:
    mappings:
${mapEntries || "      (none)"}
    defaults:
${defaults || "      (none)"}
    transforms: ${t.transforms.length}
    rowFilter: ${t.rowFilter ? JSON.stringify(t.rowFilter) : "(none)"}`;
    })
    .join("\n");

  const lookupBlock = lookupCandidates.length
    ? lookupCandidates
        .map(
          (l) =>
            `  ${l.domain}.${l.dbColumn} = ${JSON.stringify(l.rawValue)} → candidates: ${
              l.candidates.length
                ? l.candidates
                    .map((c) => `${JSON.stringify(c.label)}(${c.id.slice(0, 8)}…)`)
                    .join(", ")
                : "(none)"
            }${l.canCreate ? " [can create new]" : ""}`,
        )
        .join("\n")
    : "  (all lookup values resolved)";

  const intro = isFirstTurn
    ? `The user just uploaded a sheet to the ${state.primaryDomain} page. Propose a starting plan: map columns, set defaults where the sheet is missing required fields, resolve obvious lookup values, and suggest cross-domain targets if you see 3+ columns matching another domain's schema. Be decisive — they want to see a populated preview straight away.`
    : `The user replied: ${JSON.stringify(userText)}\n\nUpdate the plan accordingly.`;

  return `${intro}

SOURCE HEADERS:
  ${state.sourceHeaders.map((h) => JSON.stringify(h)).join(", ")}

SOURCE SAMPLE (first ${sampleSourceRows.length} rows, secrets redacted):
${sampleSourceRows.map((r, i) => `  row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}

PRIMARY DOMAIN: ${state.primaryDomain}

ACTIVE TARGETS:
${targetSummary}

CROSS-DOMAIN LINKS:
${state.links.length ? state.links.map((l) => `  ${l.fromDomain}.${l.fromColumn} ← ${l.toDomain}.${l.toLabelColumn}`).join("\n") : "  (none)"}

UNRESOLVED LOOKUP VALUES (with candidates from the existing DB):
${lookupBlock}

PREVIEW STATUS:
  cell warnings: ${cellWarningCount}
  row validation errors: ${rowErrorCount}
  cost spent so far: $${state.costUsdSpent.toFixed(4)} of $${IMPORT_CHAT_COST_CAP_USD.toFixed(2)} cap
`;
}

// ─── Transcript helpers ───────────────────────────────────────────────────

export function appendTranscript(
  state: PlanState,
  user: string,
  assistant: { text: string; mutations: unknown[] },
): ChatMessage[] {
  return [
    ...state.transcript,
    ...(user ? [{ role: "user" as const, text: user, toolCalls: [] }] : []),
    {
      role: "assistant" as const,
      text: assistant.text,
      toolCalls: assistant.mutations.map((m) => ({
        name: (m as { kind: string }).kind,
        args: m,
      })),
    },
  ];
}
