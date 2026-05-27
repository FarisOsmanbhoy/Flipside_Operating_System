// Resolve FK lookup columns during import. For each (lookupTable, value)
// pair in the spreadsheet, we look up an existing row by a fuzzy match on the
// configured labelColumn. If unmatched, the value is surfaced to the admin
// in the preview step so they can either pick an existing row or (when the
// schema allows it) create a new lookup row.
//
// Matching strategy is intentionally cheap: case+whitespace-insensitive
// exact match first; if that misses, normalised-stripped equality (drops
// punctuation, collapses spaces). We don't do edit-distance scoring — the
// AI clarification step handles the harder cases.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportColumn, ImportSchema } from "./schemas";

export type LookupCandidate = {
  rawValue: string;
  match: { id: string; label: string } | null;
  candidates: { id: string; label: string }[];
  // True if the schema permits creating a new lookup row from this value.
  canCreate: boolean;
};

export type LookupColumnResult = {
  column: string;
  table: string;
  // Map from rawValue (verbatim cell content) -> resolution.
  values: Map<string, LookupCandidate>;
};

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
}

async function fetchLookupRows(
  supabase: SupabaseClient,
  table: string,
  labelColumn: string,
): Promise<{ id: string; label: string }[]> {
  // labelColumn varies per table; PostgREST handles dynamic column names fine,
  // but Supabase's typed select() can't resolve a runtime column name.
  // Cast through unknown to a permissive row shape.
  const query = supabase.from(table).select(`id, ${labelColumn}`).limit(500);
  const { data, error } = (await query) as unknown as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };
  if (error) {
    throw new Error(`lookup fetch failed for ${table}: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: row[labelColumn] == null ? "" : String(row[labelColumn]),
  }));
}

function findMatch(
  raw: string,
  rows: { id: string; label: string }[],
): { id: string; label: string } | null {
  const target = normalise(raw);
  if (!target) return null;
  // Exact (normalised) first.
  const exact = rows.find((r) => normalise(r.label) === target);
  if (exact) return exact;
  // Prefix match (helps "ACME" -> "Acme Ltd").
  const prefix = rows.find((r) => {
    const n = normalise(r.label);
    return n.startsWith(target) || target.startsWith(n);
  });
  return prefix ?? null;
}

type ResolveArgs = {
  supabase: SupabaseClient;
  schema: ImportSchema;
  mapping: { excelHeader: string; dbColumn: string }[]; // already-finalised mapping
  rows: Record<string, unknown>[];
};

export async function resolveLookups(
  args: ResolveArgs,
): Promise<LookupColumnResult[]> {
  const lookupColumns = args.schema.columns.filter(
    (c): c is ImportColumn & { lookup: NonNullable<ImportColumn["lookup"]> } =>
      Boolean(c.lookup),
  );

  const results: LookupColumnResult[] = [];

  for (const col of lookupColumns) {
    const mapEntry = args.mapping.find((m) => m.dbColumn === col.column);
    if (!mapEntry) continue; // column not mapped in this import

    // Collect distinct raw values for this column across all rows.
    const distinctRaw = new Set<string>();
    for (const row of args.rows) {
      const v = row[mapEntry.excelHeader];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) distinctRaw.add(s);
    }

    if (distinctRaw.size === 0) continue;

    const rows = await fetchLookupRows(args.supabase, col.lookup.table, col.lookup.labelColumn);
    const values = new Map<string, LookupCandidate>();
    for (const raw of distinctRaw) {
      values.set(raw, {
        rawValue: raw,
        match: findMatch(raw, rows),
        candidates: rows.slice(0, 50), // for admin override picker
        canCreate: col.lookup.allowCreate,
      });
    }

    results.push({ column: col.column, table: col.lookup.table, values });
  }

  return results;
}

// Helper: resolve a single raw value against a pre-fetched candidate list.
// Pure — exposed for unit/smoke testing.
export function _matchValue(
  raw: string,
  rows: { id: string; label: string }[],
): { id: string; label: string } | null {
  return findMatch(raw, rows);
}
