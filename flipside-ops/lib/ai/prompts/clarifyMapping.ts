// Sonnet-driven follow-up chat for low-confidence column mappings or
// unresolved FK lookup values. The model gets the current mapping + the open
// questions, talks to the admin in plain English, and on each turn returns
// either (a) more questions, or (b) an updated mapping/resolution.
//
// We keep this as a "guided chat" rather than free agentic: the model is told
// to focus on one open question per turn, propose options, and stop asking
// once everything is resolved.

import { z } from "zod";

import type { ImportColumn } from "@/lib/import/schemas";

export const clarifyOutputSchema = z.object({
  // Natural-language message to show the admin (markdown OK, no code fences).
  message: z.string(),
  // Optional structured updates the wizard should apply.
  updates: z
    .object({
      mappingPatches: z
        .array(
          z.object({
            excelHeader: z.string(),
            dbColumn: z.string().nullable(),
            reason: z.string(),
          }),
        )
        .default([]),
      lookupChoices: z
        .array(
          z.object({
            dbColumn: z.string(),
            rawValue: z.string(),
            // Resolution: either the existing lookup row id, "create_new"
            // (when the schema allows), or "skip" (leave column null).
            resolution: z.union([
              z.object({ kind: z.literal("existing"), id: z.string() }),
              z.object({ kind: z.literal("create_new"), label: z.string() }),
              z.object({ kind: z.literal("skip") }),
            ]),
          }),
        )
        .default([]),
    })
    .default({ mappingPatches: [], lookupChoices: [] }),
  // When true, the wizard considers the clarify step complete and advances
  // to preview. Set false if more questions remain.
  done: z.boolean(),
});

export type ClarifyOutput = z.infer<typeof clarifyOutputSchema>;

export const clarifySystem = `You are an import assistant helping a FlipSide \
Ops admin resolve ambiguities in a spreadsheet column mapping.

You will receive:
- The target database schema (columns + descriptions)
- The current proposed mapping (Excel header -> DB column)
- A list of open questions: low-confidence mappings and unmatched lookup values
- The admin's previous reply, if any

Rules:
- Address one open question at a time, in the most natural order.
- Reference the actual Excel header and a sample value when helpful.
- For lookup values: list the closest existing candidates and let the admin \
pick one, OR create a new lookup row (only when the schema allows it), OR skip.
- Be concise — admins are busy.
- When ALL open questions are resolved, set 'done' to true and include a brief \
'Ready to preview' message.
- Always return strict JSON matching the output schema. The 'message' field is \
the human-facing text; 'updates' applies structured changes.`;

type BuildArgs = {
  targetColumns: ImportColumn[];
  currentMapping: { excelHeader: string; dbColumn: string | null; confidence: number }[];
  openMappingQuestions: { excelHeader: string; sampleValues: unknown[]; reason: string }[];
  openLookupQuestions: {
    dbColumn: string;
    rawValue: string;
    candidates: { id: string; label: string }[];
    canCreate: boolean;
  }[];
};

export function buildClarifyUser(args: BuildArgs): string {
  return [
    "TARGET DB COLUMNS:",
    args.targetColumns
      .map((c) => `- ${c.column}${c.required ? " (required)" : ""}: ${c.description}`)
      .join("\n"),
    "",
    "CURRENT MAPPING:",
    args.currentMapping
      .map(
        (m) =>
          `- "${m.excelHeader}" -> ${m.dbColumn ?? "(unmapped)"} (confidence ${m.confidence.toFixed(2)})`,
      )
      .join("\n"),
    "",
    `OPEN MAPPING QUESTIONS (${args.openMappingQuestions.length}):`,
    args.openMappingQuestions.length
      ? args.openMappingQuestions
          .map(
            (q) =>
              `- "${q.excelHeader}" — ${q.reason}. Sample values: ${JSON.stringify(q.sampleValues.slice(0, 3))}`,
          )
          .join("\n")
      : "(none)",
    "",
    `OPEN LOOKUP QUESTIONS (${args.openLookupQuestions.length}):`,
    args.openLookupQuestions.length
      ? args.openLookupQuestions
          .map(
            (q) =>
              `- column '${q.dbColumn}', raw value "${q.rawValue}". Top existing options: ${JSON.stringify(q.candidates.slice(0, 5).map((c) => c.label))}${q.canCreate ? " — create_new allowed" : " — must pick existing or skip"}`,
          )
          .join("\n")
      : "(none)",
  ].join("\n");
}
