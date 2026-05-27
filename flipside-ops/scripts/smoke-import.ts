/**
 * Import-pipeline smoke test for the chat-driven importer.
 *
 *   1. Parser reads headers + cells correctly (incl. Date conversion).
 *   2. Pure resolver: applyPlan turns a hand-built PlanState into the right
 *      resolved rows, defaults, lookup sentinels, warnings.
 *   3. Cross-domain commit: topo-sort + FK wiring against a small fake
 *      ApplyResult (no live DB — uses an in-memory Supabase stub).
 *   4. AI chat turn: invoke importChat prompt against Sonnet, assert the
 *      response is well-formed and includes plausible mutations for an
 *      obviously-shaped clients sheet.
 *
 * Skips real DB inserts (commitImport against live Supabase) — that's
 * covered by the manual E2E scenarios in the plan.
 *
 * Run:  npm run smoke:import
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

  const ExcelJS = (await import("exceljs")).default;
  const { parseSpreadsheet } = await import("../lib/import/parser");
  const { initialPlanState, lookupChoiceKey } = await import("../lib/import/planState");
  const { applyPlan } = await import("../lib/import/applyPlan");
  const { crossDomainCommit } = await import("../lib/import/crossDomainCommit");

  // ── Build a tiny xlsx ──────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["Company Name", "Type", "Status", "City", "Start Date"]);
  ws.addRow(["Acme Builders Ltd", "Architect", "Active", "Sheffield", new Date(Date.UTC(2024, 5, 1))]);
  ws.addRow(["Beta Properties", "Developer", "Active", "Leeds", new Date(Date.UTC(2023, 2, 15))]);
  ws.addRow(["Gamma Holdings", "Strategic Partner", "dormant", "Manchester", new Date(Date.UTC(2022, 10, 8))]);
  const buf = await wb.xlsx.writeBuffer();

  // ── 1. Parser ──────────────────────────────────────────────────────
  const parsed = await parseSpreadsheet(
    "test.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buf as ArrayBuffer,
  );
  log(parsed.headers[0] === "Company Name", "parser: read 5 headers");
  log(parsed.rows.length === 3, `parser: 3 data rows (got ${parsed.rows.length})`);
  log(
    parsed.rows[0]["Start Date"] === "2024-06-01",
    `parser: Date converted to YYYY-MM-DD`,
  );

  // ── 2. applyPlan: missing-required default + new-lookup sentinel ───
  // Hand-built plan that mimics what the AI would produce: maps Company Name -> name,
  // defaults status to a new "Active" lookup, leaves Type unresolved.
  const planForRequired = initialPlanState({
    primaryDomain: "clients",
    sourceHeaders: parsed.headers,
    sourceRows: parsed.rows,
  });
  planForRequired.targets.clients = {
    mappings: {
      "Company Name": "name",
      "City": "location",
      "Start Date": "since_date",
    },
    defaults: {},
    transforms: [],
    lookupChoices: {
      [lookupChoiceKey("status_id", "Active")]: { kind: "create", label: "Active" },
      [lookupChoiceKey("status_id", "dormant")]: { kind: "create", label: "Dormant" },
    },
  };
  const applied = applyPlan(planForRequired);
  const clients = applied.byDomain.clients!;
  log(
    clients.resolvedRows.length === 3,
    `applyPlan: 3 resolved client rows (got ${clients.resolvedRows.length})`,
  );
  log(
    typeof clients.resolvedRows[0].name === "string" && clients.resolvedRows[0].name === "Acme Builders Ltd",
    `applyPlan: name mapped from "Company Name"`,
  );
  log(
    clients.resolvedRows[0].since_date === "2024-06-01",
    `applyPlan: since_date passes through unchanged`,
  );
  log(
    clients.newLookups.length === 2 && clients.newLookups.every((l) => l.table === "client_statuses"),
    `applyPlan: 2 new client_statuses lookups queued (got ${clients.newLookups.length})`,
  );
  // type_id has no mapping AND is optional -> no warnings for it; status sentinel cells should warn.
  const statusInfoWarnings = clients.cellWarnings.filter(
    (w) => w.column === "status_id" && w.severity === "info",
  );
  log(
    statusInfoWarnings.length === 3,
    `applyPlan: 3 'will create new' info warnings on status_id (got ${statusInfoWarnings.length})`,
  );

  // ── 3. crossDomainCommit topo-sort with in-memory stub ─────────────
  // Build a fake ApplyResult: parent (clients) before child (passwords) by FK
  // passwords.client_id <- clients.name.
  const fakeApply = {
    byDomain: {
      clients: {
        domain: "clients" as const,
        schema: (await import("../lib/import/schemas")).getImportSchema("clients"),
        resolvedRows: [
          { name: "Acme Builders Ltd" },
          { name: "Beta Properties" },
        ],
        cellWarnings: [],
        newLookups: [],
        rowErrors: [],
      },
      passwords: {
        domain: "passwords" as const,
        schema: (await import("../lib/import/schemas")).getImportSchema("passwords"),
        resolvedRows: [
          // client_id will be wired by link_rows; system + category_id required.
          { system: "Acme Portal", category_id: "00000000-0000-0000-0000-000000000111", client_id: "Acme Builders Ltd" },
        ],
        cellWarnings: [],
        newLookups: [],
        rowErrors: [],
      },
    },
    links: [
      {
        fromDomain: "passwords" as const,
        fromColumn: "client_id",
        toDomain: "clients" as const,
        toLabelColumn: "name",
      },
    ],
  };

  // In-memory Supabase stub. crossDomainCommit calls:
  //   from(t).insert(row).select("id").single()  -> for new lookup rows
  //   await from(t).insert(rows).select("*")     -> for batched data inserts
  //   from(t).delete().in("id", ids)             -> rollback path
  const stubData: Record<string, Record<string, unknown>[]> = { clients: [], passwords: [] };
  let uuidCounter = 0;
  const stub = {
    from: (table: string) => ({
      insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const inserted = arr.map((r) => ({ ...r, id: `uuid-${++uuidCounter}` }));
        stubData[table] = (stubData[table] ?? []).concat(inserted);
        return {
          select: () => ({
            single: async () => ({ data: inserted[0], error: null }),
            then: (resolve: (v: { data: typeof inserted; error: null }) => void) =>
              resolve({ data: inserted, error: null }),
          }),
        };
      },
      delete: () => ({ in: async () => ({ data: null, error: null }) }),
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commitRes = await crossDomainCommit({ supabase: stub as any, actorId: "test", apply: fakeApply });
  log(commitRes.ok, `crossDomainCommit: ok (${commitRes.ok ? "" : (commitRes as { error: string }).error})`);
  if (commitRes.ok) {
    log(
      commitRes.insertedByDomain.clients === 2,
      `crossDomainCommit: 2 clients inserted (got ${commitRes.insertedByDomain.clients})`,
    );
    log(
      commitRes.insertedByDomain.passwords === 1,
      `crossDomainCommit: 1 password inserted (got ${commitRes.insertedByDomain.passwords})`,
    );
    // The inserted password row's client_id should be a real uuid (uuid-1 or uuid-2),
    // wired by link_rows.
    const insertedPwd = stubData.passwords[0];
    log(
      typeof insertedPwd?.client_id === "string" && (insertedPwd!.client_id as string).startsWith("uuid-"),
      `crossDomainCommit: passwords.client_id wired to clients.id (got ${JSON.stringify(insertedPwd?.client_id)})`,
    );
  }

  // ── 4. AI chat turn (Sonnet) — skip if no API key ─────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[SKIP] AI chat turn — ANTHROPIC_API_KEY not set");
  } else {
    const { complete } = await import("../lib/ai/_client-core");
    const { SONNET } = await import("../lib/ai/models");
    const { buildImportChatSystemPrompt, buildImportChatUserMessage, importChatOutputSchema } =
      await import("../lib/ai/prompts/importChat");
    const startState = initialPlanState({
      primaryDomain: "clients",
      sourceHeaders: parsed.headers,
      sourceRows: parsed.rows,
    });
    const res = await complete({
      model: SONNET,
      system: buildImportChatSystemPrompt(),
      user: buildImportChatUserMessage({
        state: startState,
        sampleSourceRows: parsed.rows.slice(0, 5),
        lookupCandidates: [],
        cellWarningCount: 0,
        rowErrorCount: 0,
        userText: "",
        isFirstTurn: true,
      }),
      outputSchema: importChatOutputSchema,
      maxTokens: 2000,
    });
    log(
      res.data.assistantText.length > 0,
      `chat turn: assistantText non-empty (${res.data.assistantText.length} chars)`,
    );
    const setMappings = res.data.mutations.filter((m) => m.kind === "set_mapping");
    log(
      setMappings.length >= 3,
      `chat turn: AI emitted >=3 set_mapping mutations (got ${setMappings.length})`,
    );
    const nameMap = setMappings.find(
      (m) => m.kind === "set_mapping" && m.excelHeader === "Company Name",
    );
    log(
      !!nameMap && nameMap.kind === "set_mapping" && nameMap.dbColumn === "name",
      `chat turn: Company Name -> name (got ${nameMap?.kind === "set_mapping" ? nameMap.dbColumn : "no mapping"})`,
    );
    console.log(`   AI usage: ${res.inputTokens} in / ${res.outputTokens} out, $${res.costUsd.toFixed(6)}`);
  }

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
