/**
 * Import-pipeline smoke test. Generates a small xlsx in-memory, runs it
 * through the parser and the lookup resolver, then calls the AI mapping
 * proposal against the clients schema. Verifies:
 *
 *   - parser reads headers + cells correctly (including a Date cell)
 *   - lookup resolver fuzzy-matches existing client_types/client_statuses
 *     rows by name
 *   - AI mapping (Haiku) returns sensible high-confidence mappings for
 *     obvious headers
 *
 * Skips the actual DB insert (commitImport) — that's covered by manual E2E.
 *
 * Run:  npx tsx scripts/smoke-import.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// env loader (same pattern as smoke-admin / smoke-ai)
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

async function main() {
  let failures = 0;
  const log = (ok: boolean, label: string, extra?: string) => {
    console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${extra ? "  " + extra : ""}`);
    if (!ok) failures++;
  };

  const ExcelJS = (await import("exceljs")).default;
  const { parseSpreadsheet } = await import("../lib/import/parser");

  // ── Build a tiny xlsx in-memory ─────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["Company Name", "Type", "Status", "City", "Account Manager", "Start Date"]);
  ws.addRow(["Acme Builders Ltd", "Architect", "Active", "Sheffield", "Faris Osmanbhoy", new Date(Date.UTC(2024, 5, 1))]);
  ws.addRow(["Beta Properties", "Developer", "Active", "Leeds", "Faris Osmanbhoy", new Date(Date.UTC(2023, 2, 15))]);
  ws.addRow(["Gamma Holdings", "client", "dormant", "Manchester", "", new Date(Date.UTC(2022, 10, 8))]);
  const buf = await wb.xlsx.writeBuffer();

  // ── 1. Parser ──────────────────────────────────────────────────────
  const parsed = await parseSpreadsheet(
    "test.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buf as ArrayBuffer,
  );
  log(
    parsed.headers.length === 6 && parsed.headers[0] === "Company Name",
    "parser: read 6 headers (Company Name first)",
  );
  log(
    parsed.rows.length === 3,
    `parser: 3 data rows after header (got ${parsed.rows.length})`,
  );
  const firstDate = parsed.rows[0]["Start Date"];
  log(
    firstDate === "2024-06-01",
    `parser: Excel Date cell converted to YYYY-MM-DD (got ${JSON.stringify(firstDate)})`,
  );

  // ── 2. AI mapping (Haiku) ──────────────────────────────────────────
  const { complete } = await import("../lib/ai/_client-core");
  const { HAIKU } = await import("../lib/ai/models");
  const { mapColumnsSystem, buildMapColumnsUser, mapColumnsOutputSchema } =
    await import("../lib/ai/prompts/mapColumns");
  const { getImportSchema } = await import("../lib/import/schemas");

  const schema = getImportSchema("clients");
  const res = await complete({
    model: HAIKU,
    system: mapColumnsSystem,
    user: buildMapColumnsUser({
      targetSchema: schema.columns.map((c) => ({
        column: c.column,
        description: c.description,
        required: c.required,
      })),
      excelHeaders: parsed.headers,
      sampleRows: parsed.sampleRows,
    }),
    outputSchema: mapColumnsOutputSchema,
    maxTokens: 1500,
  });
  const findMap = (excelHeader: string) =>
    res.data.mapping.find((m) => m.excelHeader === excelHeader);

  log(
    findMap("Company Name")?.dbColumn === "name",
    `mapping: "Company Name" -> name (got ${findMap("Company Name")?.dbColumn})`,
  );
  log(
    findMap("Type")?.dbColumn === "type_id",
    `mapping: "Type" -> type_id (got ${findMap("Type")?.dbColumn})`,
  );
  log(
    findMap("Status")?.dbColumn === "status_id",
    `mapping: "Status" -> status_id (got ${findMap("Status")?.dbColumn})`,
  );
  log(
    findMap("Start Date")?.dbColumn === "since_date",
    `mapping: "Start Date" -> since_date (got ${findMap("Start Date")?.dbColumn})`,
  );
  log(
    findMap("Account Manager")?.dbColumn === "assigned_pm_id",
    `mapping: "Account Manager" -> assigned_pm_id (got ${findMap("Account Manager")?.dbColumn})`,
  );
  console.log(
    `   AI usage: ${res.inputTokens} in / ${res.outputTokens} out, $${res.costUsd.toFixed(6)}`,
  );

  // ── 3. Lookup resolver ─────────────────────────────────────────────
  const { resolveLookups } = await import("../lib/import/resolveLookups");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const mapping = [
    { excelHeader: "Type", dbColumn: "type_id" },
    { excelHeader: "Status", dbColumn: "status_id" },
  ];
  const lookups = await resolveLookups({
    supabase,
    schema,
    mapping,
    rows: parsed.rows,
  });
  const typeRes = lookups.find((l) => l.column === "type_id");
  const statusRes = lookups.find((l) => l.column === "status_id");
  const architect = typeRes?.values.get("Architect");
  const dormant = statusRes?.values.get("dormant");
  log(
    !!architect && architect.match !== null,
    `lookups: "Architect" matched against client_types${architect?.match ? ` (-> ${architect.match.label})` : ""}`,
  );
  log(
    !!dormant,
    `lookups: "dormant" found as distinct value`,
  );

  console.log("");
  if (failures > 0) {
    console.error(`${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("All import smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
