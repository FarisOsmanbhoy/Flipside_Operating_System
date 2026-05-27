import { z } from "zod";

// The AI proposes a mapping from each Excel header to either a target DB
// column, "skip" (admin doesn't want this column imported), or null
// ("needs_clarification" — surfaced to the admin in the clarify step).

export const mapColumnsOutputSchema = z.object({
  mapping: z.array(
    z.object({
      excelHeader: z.string(),
      dbColumn: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
  unmappedConcerns: z.array(z.string()).default([]),
});

export type MapColumnsOutput = z.infer<typeof mapColumnsOutputSchema>;

export const mapColumnsSystem = `You are an import assistant for FlipSide Ops. \
Your job is to map columns in a user-uploaded spreadsheet onto the database \
schema of a target table.

Rules:
- For each Excel header, propose exactly one of:
  * a string matching one of the target DB column keys (dbColumn = that key)
  * null, meaning you cannot confidently map it (use this for ambiguous columns)
- Set confidence to your honest 0..1 belief that the mapping is correct.
- Be conservative: when in doubt, return null and explain in 'reason'.
- A target column should appear at most once across the mapping.
- If multiple Excel headers seem to map to the same target column, pick the
  best one and return null for the others with a reason like "duplicate of X".
- Use the sample rows (which may show <redacted> placeholders for sensitive \
columns like passwords) to disambiguate when header text alone is unclear.
- List any wider concerns about the spreadsheet in 'unmappedConcerns' \
(e.g., "Sheet appears to mix two entities", "Date format ambiguous").`;

type BuildArgs = {
  targetSchema: { column: string; description: string; required: boolean }[];
  excelHeaders: string[];
  sampleRows: Record<string, unknown>[];
};

export function buildMapColumnsUser(args: BuildArgs): string {
  return [
    "TARGET DB COLUMNS:",
    args.targetSchema
      .map(
        (c) =>
          `- ${c.column}${c.required ? " (required)" : ""}: ${c.description}`,
      )
      .join("\n"),
    "",
    "EXCEL HEADERS:",
    args.excelHeaders.map((h) => `- ${JSON.stringify(h)}`).join("\n"),
    "",
    `SAMPLE ROWS (first ${args.sampleRows.length}):`,
    JSON.stringify(args.sampleRows, null, 2),
    "",
    "Respond with JSON matching this shape:",
    JSON.stringify(
      {
        mapping: [
          {
            excelHeader: "string",
            dbColumn: "string | null",
            confidence: "0..1",
            reason: "string",
          },
        ],
        unmappedConcerns: ["string"],
      },
      null,
      2,
    ),
  ].join("\n");
}
