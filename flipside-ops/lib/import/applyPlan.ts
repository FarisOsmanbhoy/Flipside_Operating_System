// Pure resolver: PlanState -> resolved rows per target.
//
// Same function drives the preview pane and the commit path. No side effects,
// no I/O — given the same plan it returns the same rows.
//
// Output per target:
//   resolvedRows: rows keyed by dbColumn. Lookups are either uuid strings,
//                 the sentinel "__create__:<label>", or null.
//   cellWarnings: per-row+column annotations the preview uses to badge cells
//                 (AI assumption, new lookup, missing-required, etc.).
//   newLookupLabels: { table, labelColumn, label, column }[] — passed to
//                    crossDomainCommit so it can create the lookup rows first.

import { z } from "zod";

import {
  type FkLink,
  type PlanState,
  type SourceRow,
  type TargetPlan,
  type TransformRule,
  lookupChoiceKey,
} from "./planState";
import { getImportSchema, type ImportDomain, type ImportSchema } from "./schemas";

export type CellWarning = {
  rowIndex: number;
  column: string;
  severity: "info" | "needs_input";
  message: string;
};

export type NewLookupSpec = {
  table: string;
  labelColumn: string;
  label: string;
  column: string; // dbColumn on the parent rows whose sentinel will be patched
};

export type ResolvedDomain = {
  domain: ImportDomain;
  schema: ImportSchema;
  resolvedRows: Record<string, unknown>[];
  cellWarnings: CellWarning[];
  newLookups: NewLookupSpec[];
  // Row-level Zod errors so the UI can mark rows as needing input.
  rowErrors: { rowIndex: number; reason: string }[];
};

export type ApplyResult = {
  byDomain: Partial<Record<ImportDomain, ResolvedDomain>>;
  links: FkLink[]; // pass-through for the commit step
};

const CREATE_SENTINEL_PREFIX = "__create__:";

export function isCreateSentinel(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(CREATE_SENTINEL_PREFIX);
}

export function createSentinel(label: string): string {
  return `${CREATE_SENTINEL_PREFIX}${label}`;
}

export function createSentinelLabel(s: string): string {
  return s.slice(CREATE_SENTINEL_PREFIX.length);
}

// ─────────────────────────────────────────────────────────────────────────

export function applyPlan(state: PlanState): ApplyResult {
  const byDomain: Partial<Record<ImportDomain, ResolvedDomain>> = {};
  for (const [domain, plan] of Object.entries(state.targets) as [ImportDomain, TargetPlan][]) {
    byDomain[domain] = applyPlanForTarget(domain, plan, state.sourceRows);
  }
  return { byDomain, links: state.links };
}

function applyPlanForTarget(
  domain: ImportDomain,
  plan: TargetPlan,
  sourceRows: SourceRow[],
): ResolvedDomain {
  const schema = getImportSchema(domain);
  const cellWarnings: CellWarning[] = [];
  const newLookupSeen = new Set<string>();
  const newLookups: NewLookupSpec[] = [];
  const rowErrors: { rowIndex: number; reason: string }[] = [];

  // 1. Apply rowFilter (filter is over source rows, not mapped).
  const rows = plan.rowFilter
    ? sourceRows
        .map((row, i) => ({ row, originalIndex: i }))
        .filter(({ row }) => {
          const v = row[plan.rowFilter!.sourceColumn];
          if (v == null) return false;
          return plan.rowFilter!.matchAny.includes(String(v));
        })
    : sourceRows.map((row, i) => ({ row, originalIndex: i }));

  // 2. Build mapping inverse: dbColumn -> excelHeader (last write wins).
  const dbToExcel: Record<string, string> = {};
  for (const [excel, db] of Object.entries(plan.mappings)) {
    dbToExcel[db] = excel;
  }

  // 3. Resolve each row.
  const resolvedRows: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { row, originalIndex } = rows[i];
    const out: Record<string, unknown> = {};

    for (const col of schema.columns) {
      const excelHeader = dbToExcel[col.column];
      let raw: unknown =
        excelHeader !== undefined ? row[excelHeader] : undefined;

      // Default if no source value.
      if ((raw === undefined || raw === null || raw === "") && col.column in plan.defaults) {
        raw = plan.defaults[col.column];
        cellWarnings.push({
          rowIndex: originalIndex,
          column: col.column,
          severity: "info",
          message: `Defaulted to ${JSON.stringify(plan.defaults[col.column])}`,
        });
      }

      // Required but missing — flag, leave null.
      if ((raw === undefined || raw === null || raw === "") && col.required) {
        cellWarnings.push({
          rowIndex: originalIndex,
          column: col.column,
          severity: "needs_input",
          message: `Required field "${col.column}" has no value`,
        });
        out[col.column] = null;
        continue;
      }

      // Lookup resolution.
      if (col.lookup) {
        if (raw === undefined || raw === null || raw === "") {
          out[col.column] = null;
          continue;
        }
        const key = lookupChoiceKey(col.column, String(raw).trim());
        const choice = plan.lookupChoices[key];
        if (!choice) {
          cellWarnings.push({
            rowIndex: originalIndex,
            column: col.column,
            severity: "needs_input",
            message: `Lookup value "${raw}" not resolved`,
          });
          out[col.column] = null;
          continue;
        }
        if (choice.kind === "existing") {
          out[col.column] = choice.id;
        } else if (choice.kind === "skip") {
          out[col.column] = null;
        } else {
          // create
          const lookupKey = `${col.lookup.table}|${choice.label}|${col.column}`;
          if (!newLookupSeen.has(lookupKey)) {
            newLookupSeen.add(lookupKey);
            newLookups.push({
              table: col.lookup.table,
              labelColumn: col.lookup.labelColumn,
              label: choice.label,
              column: col.column,
            });
          }
          out[col.column] = createSentinel(choice.label);
          cellWarnings.push({
            rowIndex: originalIndex,
            column: col.column,
            severity: "info",
            message: `Will create new ${col.lookup.table}: "${choice.label}"`,
          });
        }
        continue;
      }

      // Scalar: trim strings, blank -> null.
      if (typeof raw === "string") {
        const s = raw.trim();
        out[col.column] = s === "" ? null : s;
      } else if (raw === undefined) {
        out[col.column] = null;
      } else {
        out[col.column] = raw;
      }
    }

    // 4. Apply transforms (in order) to the resolved row.
    applyTransforms(out, plan.transforms);

    resolvedRows.push(out);

    // 5. Per-row Zod check (preview only — commit re-validates server-side).
    const result = schema.rowSchema.safeParse(out);
    if (!result.success) {
      rowErrors.push({
        rowIndex: originalIndex,
        reason: result.error.issues
          .map((iss: z.core.$ZodIssue) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; "),
      });
    }
  }

  return { domain, schema, resolvedRows, cellWarnings, newLookups, rowErrors };
}

function applyTransforms(row: Record<string, unknown>, rules: TransformRule[]): void {
  for (const r of rules) {
    switch (r.kind) {
      case "trim": {
        const v = row[r.column];
        if (typeof v === "string") row[r.column] = v.trim();
        break;
      }
      case "uppercase": {
        const v = row[r.column];
        if (typeof v === "string") row[r.column] = v.toUpperCase();
        break;
      }
      case "lowercase": {
        const v = row[r.column];
        if (typeof v === "string") row[r.column] = v.toLowerCase();
        break;
      }
      case "split_name": {
        const v = row[r.sourceColumn];
        if (typeof v === "string") {
          const parts = v.trim().split(/\s+/);
          const first = parts.shift() ?? "";
          const last = parts.join(" ");
          row[r.firstInto] = first || null;
          row[r.lastInto] = last || null;
        }
        break;
      }
      case "regex_extract": {
        const v = row[r.sourceColumn];
        if (typeof v === "string") {
          const m = new RegExp(r.pattern).exec(v);
          row[r.intoColumn] = m ? m[1] ?? m[0] : null;
        }
        break;
      }
      case "constant": {
        row[r.column] = r.value;
        break;
      }
    }
  }
}
