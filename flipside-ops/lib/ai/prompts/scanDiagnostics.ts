// Prompt for the AI diagnostics scanner. Receives a batch of rows from one
// domain (clients or suppliers) and returns a list of data-quality findings.
// We DO NOT pass passwords through this scanner (per the plan's privacy
// boundary) so the row payload here is always low-sensitivity.

import { z } from "zod";

export const scanFindingSchema = z.object({
  entity_id: z.string(),
  // Pre-normalise case before validating against the enum — the model
  // sometimes echoes our uppercase prompt headers.
  issue_type: z
    .string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["duplicate", "missing_field", "anomaly"])),
  severity: z
    .string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["info", "warn"])),
  suggestion: z.string(),
  // Free-form extras shaped per issue type:
  //   duplicate     -> { duplicate_of: <other entity_id> }
  //   missing_field -> { field: <db column name> }
  //   anomaly       -> { field?: <db column>, value?: <raw> }
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const scanDiagnosticsOutputSchema = z.object({
  findings: z.array(scanFindingSchema),
});

export type ScanDiagnosticsOutput = z.infer<
  typeof scanDiagnosticsOutputSchema
>;

export const scanDiagnosticsSystem = `You are a data-quality assistant for \
FlipSide Ops. You scan rows from one entity (clients or suppliers) and report \
issues an admin should review.

Look for:
- DUPLICATES: rows that very likely refer to the same real-world entity \
(e.g. "Acme Ltd" vs "Acme Limited", same location). Report each duplicate \
ONCE, citing the other row's entity_id in payload.duplicate_of.
- MISSING_FIELD: a field that is blank but other rows usually have it \
populated (e.g. most rows have type_id but this one doesn't). Cite the \
DB column in payload.field.
- ANOMALY: a value that looks malformed or inconsistent — bad date format, \
all-caps in a name field, suspicious characters, unlikely combination. Cite \
the column + raw value in payload.

Rules:
- Only report findings you are reasonably confident about. False positives \
waste admin time more than false negatives.
- Be terse in 'suggestion' (one sentence; admin-facing).
- Use severity 'warn' for likely data-integrity issues (duplicates, malformed \
data); 'info' for soft suggestions (missing optional fields, stylistic).
- Always return strict JSON matching the schema. No prose, no fences.`;

type Row = { id: string; [key: string]: unknown };

export function buildScanDiagnosticsUser(args: {
  entityType: "client" | "supplier";
  rows: Row[];
  schemaColumns: { column: string; description: string }[];
}): string {
  return [
    `ENTITY: ${args.entityType}`,
    "",
    "SCHEMA:",
    args.schemaColumns
      .map((c) => `- ${c.column}: ${c.description}`)
      .join("\n"),
    "",
    `ROWS (${args.rows.length}):`,
    JSON.stringify(args.rows, null, 2),
    "",
    "Respond with JSON: { \"findings\": [ { entity_id, issue_type, severity, suggestion, payload? } ] }",
  ].join("\n");
}
