/**
 * Diagnostics smoke. Calls Claude with the scanDiagnostics prompt against a
 * tiny synthetic batch of two near-duplicate clients + verifies it returns a
 * "duplicate" finding pointing one row at the other. Then exercises the
 * suggestField prompt to pick a type from a small list.
 *
 * Doesn't touch the DB: avoids polluting the real ai_diagnostics table with
 * synthetic findings. The full runDiagnostics path is covered by the in-app
 * UI button.
 *
 * Run:  npx tsx scripts/smoke-diagnostics.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  const { complete } = await import("../lib/ai/_client-core");
  const { HAIKU } = await import("../lib/ai/models");

  // ── 1. scanDiagnostics: duplicate detection ────────────────────────
  const {
    scanDiagnosticsSystem,
    buildScanDiagnosticsUser,
    scanDiagnosticsOutputSchema,
  } = await import("../lib/ai/prompts/scanDiagnostics");

  const rows = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Acme Builders Ltd",
      location: "Sheffield",
      type_id: "type-a",
      status_id: "status-active",
      important_info: null,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Acme Builders Limited",
      location: "Sheffield",
      type_id: null,
      status_id: "status-active",
      important_info: null,
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Beta Properties",
      location: "Leeds",
      type_id: "type-b",
      status_id: "status-active",
      important_info: null,
    },
  ];

  const scanRes = await complete({
    model: HAIKU,
    system: scanDiagnosticsSystem,
    user: buildScanDiagnosticsUser({
      entityType: "client",
      rows,
      schemaColumns: [
        { column: "name", description: "Client name" },
        { column: "location", description: "City/region" },
        { column: "type_id", description: "Client type (FK)" },
        { column: "status_id", description: "Lifecycle status (FK)" },
        { column: "important_info", description: "Headline info" },
      ],
    }),
    outputSchema: scanDiagnosticsOutputSchema,
    maxTokens: 2000,
  });
  const dupFinding = scanRes.data.findings.find(
    (f) => f.issue_type === "duplicate",
  );
  log(
    !!dupFinding,
    `scan: returned a duplicate finding (got ${scanRes.data.findings.length} total)`,
  );
  log(
    !!dupFinding &&
      typeof dupFinding.payload?.duplicate_of === "string" &&
      (rows.map((r) => r.id).includes(String(dupFinding.payload.duplicate_of)) ||
        rows.map((r) => r.id).includes(dupFinding.entity_id)),
    `scan: duplicate references one of the input ids`,
  );
  console.log(
    `   scan tokens: ${scanRes.inputTokens} in / ${scanRes.outputTokens} out, $${scanRes.costUsd.toFixed(6)}`,
  );

  // ── 2. suggestField: pick best type ─────────────────────────────────
  const {
    suggestFieldSystem,
    buildSuggestFieldUser,
    suggestFieldOutputSchema,
  } = await import("../lib/ai/prompts/suggestField");

  const sugRes = await complete({
    model: HAIKU,
    system: suggestFieldSystem,
    user: buildSuggestFieldUser({
      entityType: "client",
      dbColumn: "type_id",
      columnDescription:
        "Client type (e.g. 'Architect', 'Developer'). Maps to client_types.",
      row: {
        name: "Studio Sheffield Architects Ltd",
        location: "Sheffield",
        important_info: "Boutique residential & retail architecture firm.",
      },
      options: [
        { id: "type-arch", label: "Architect" },
        { id: "type-dev", label: "Developer" },
        { id: "type-sub", label: "Subcontractor" },
      ],
    }),
    outputSchema: suggestFieldOutputSchema,
    maxTokens: 400,
  });
  log(
    sugRes.data.suggestion_id === "type-arch",
    `suggest: picked Architect (got ${sugRes.data.suggestion_id}, label "${sugRes.data.suggestion_label}", conf ${sugRes.data.confidence})`,
  );
  console.log(
    `   suggest tokens: ${sugRes.inputTokens} in / ${sugRes.outputTokens} out, $${sugRes.costUsd.toFixed(6)}`,
  );

  console.log("");
  if (failures > 0) {
    console.error(`${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("All diagnostics smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
