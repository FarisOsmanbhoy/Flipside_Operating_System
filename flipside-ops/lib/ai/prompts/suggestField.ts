// Prompt for the inline "Suggest with AI" buttons. Given one row's non-secret
// context and a list of allowed lookup values, picks the best match (if any)
// and explains why.

import { z } from "zod";

export const suggestFieldOutputSchema = z.object({
  // Either the id of one of the supplied options or null if nothing fits.
  suggestion_id: z.string().nullable(),
  suggestion_label: z.string().nullable(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export type SuggestFieldOutput = z.infer<typeof suggestFieldOutputSchema>;

export const suggestFieldSystem = `You help a FlipSide Ops admin fill in a \
missing categorical field on a record. You will be given:
- The entity type and the row's other fields
- The DB column to fill in
- A list of allowed lookup values (id + label)

Pick the single best match if you are reasonably confident, otherwise return \
suggestion_id = null. Be concise — admins are busy.

Always return strict JSON matching the schema. No prose, no fences.`;

type SuggestArgs = {
  entityType: string;             // 'client' | 'supplier' | 'password'
  dbColumn: string;
  columnDescription: string;
  row: Record<string, unknown>;
  options: { id: string; label: string }[];
};

export function buildSuggestFieldUser(args: SuggestArgs): string {
  return [
    `ENTITY TYPE: ${args.entityType}`,
    `FIELD TO FILL: ${args.dbColumn}`,
    `FIELD DESCRIPTION: ${args.columnDescription}`,
    "",
    "ROW CONTEXT:",
    JSON.stringify(args.row, null, 2),
    "",
    `ALLOWED OPTIONS (${args.options.length}):`,
    args.options.map((o) => `- ${o.id}: ${o.label}`).join("\n"),
    "",
    "Respond with JSON: { suggestion_id, suggestion_label, reason, confidence }",
  ].join("\n");
}
