// Multi-target commit with FK wiring.
//
// Given an ApplyResult, this:
//   1. Pre-validates every row of every target with the per-domain Zod schema.
//      If any fail, the whole commit aborts with the row errors — nothing is
//      written. (Most failures should be caught here, not at insert time.)
//   2. Topo-sorts targets by `links` so parent rows insert first.
//   3. For each target, in order:
//        - Inserts any new lookup rows declared by applyPlan, patches sentinels.
//        - Walks `links` to populate FK columns by matching rawValues against
//          the parent target's already-inserted rows (matched on toLabelColumn).
//        - Inserts the validated rows in a single batch.
//   4. If any step fails mid-way, best-effort rollback: delete every UUID we
//      inserted (in reverse order), then return the error. Audit triggers
//      fire for both inserts and deletes, so the audit log tells the story.
//
// Supabase JS has no client-side transaction API; this is the cleanest
// transactional behaviour we can get without writing a SQL RPC.

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ApplyResult,
  type NewLookupSpec,
  type ResolvedDomain,
  createSentinel,
  createSentinelLabel,
  isCreateSentinel,
} from "./applyPlan";
import type { FkLink } from "./planState";
import type { ImportDomain } from "./schemas";

export type CommitFailure = {
  domain: ImportDomain;
  rowIndex: number;
  reason: string;
};

export type CrossDomainCommitResult =
  | {
      ok: true;
      insertedByDomain: Partial<Record<ImportDomain, number>>;
      newLookupsCreated: { table: string; label: string; id: string }[];
    }
  | {
      ok: false;
      error: string;
      validationFailures?: CommitFailure[];
      rolledBack?: { table: string; count: number }[];
    };

type InsertedTrack = {
  table: string;
  ids: string[];
};

export async function crossDomainCommit(args: {
  supabase: SupabaseClient;
  actorId: string;
  apply: ApplyResult;
}): Promise<CrossDomainCommitResult> {
  const { supabase, actorId, apply } = args;

  const targets = Object.values(apply.byDomain).filter(
    (t): t is ResolvedDomain => !!t,
  );
  if (targets.length === 0) {
    return { ok: false, error: "No targets in plan." };
  }

  // 1. Pre-validate everything. Validation skips FK columns wired via `links`
  //    (they'll be populated after the parent inserts; the Zod schema for
  //    those columns is .uuid().nullable().optional()).
  const validationFailures: CommitFailure[] = [];
  const validatedByDomain = new Map<ImportDomain, Record<string, unknown>[]>();

  for (const t of targets) {
    const linkedCols = apply.links
      .filter((l) => l.fromDomain === t.domain)
      .map((l) => l.fromColumn);
    const validated: Record<string, unknown>[] = [];
    t.resolvedRows.forEach((row, idx) => {
      // Strip linked columns for the pre-validate (they're injected later).
      const stripped = { ...row };
      for (const c of linkedCols) delete stripped[c];
      const r = t.schema.rowSchema.safeParse(stripped);
      if (!r.success) {
        validationFailures.push({
          domain: t.domain,
          rowIndex: idx,
          reason: r.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "),
        });
      } else {
        validated.push(r.data as Record<string, unknown>);
      }
    });
    if (validated.length > 0) validatedByDomain.set(t.domain, validated);
  }

  if (validationFailures.length > 0) {
    return {
      ok: false,
      error: `${validationFailures.length} row(s) failed validation. Fix in the chat preview before importing.`,
      validationFailures,
    };
  }

  // 2. Topo-sort targets by FK deps. parent (toDomain) before child (fromDomain).
  const order = topoSortDomains(targets.map((t) => t.domain), apply.links);
  if (order === null) {
    return { ok: false, error: "Cross-domain link cycle detected." };
  }

  // 3. Insert each target in dep order. Track inserted ids for rollback.
  const inserted: InsertedTrack[] = [];
  const newLookupsCreated: { table: string; label: string; id: string }[] = [];
  const insertedByDomain: Partial<Record<ImportDomain, number>> = {};
  // For FK linking: domain -> Map<labelValue, uuid> built from the rows we
  // just inserted (using the toLabelColumn from links). We need the rows back
  // with ids and labels post-insert.
  const insertedLabelToId = new Map<ImportDomain, Map<string, string>>();

  for (const domain of order) {
    const t = targets.find((x) => x.domain === domain);
    if (!t) continue;
    const validated = validatedByDomain.get(domain);
    if (!validated || validated.length === 0) continue;

    // 3a. Create new lookup rows for this target.
    try {
      const created = await createNewLookups({
        supabase,
        actorId,
        newLookups: t.newLookups,
      });
      for (const c of created) {
        newLookupsCreated.push(c);
        inserted.push({ table: c.table, ids: [c.id] });
      }
      // Patch sentinels in the validated rows.
      patchLookupSentinels(validated, created);
    } catch (e) {
      await rollback(supabase, inserted);
      return {
        ok: false,
        error: `Failed creating lookup rows for ${domain}: ${(e as Error).message}`,
        rolledBack: summariseRollback(inserted),
      };
    }

    // 3b. Wire FK columns from links.
    const linksFromHere = apply.links.filter((l) => l.fromDomain === domain);
    for (const link of linksFromHere) {
      const parentMap = insertedLabelToId.get(link.toDomain);
      if (!parentMap) {
        await rollback(supabase, inserted);
        return {
          ok: false,
          error: `FK link expects ${link.toDomain} to be inserted before ${domain}, but it isn't.`,
          rolledBack: summariseRollback(inserted),
        };
      }
      // The raw label lives on the source row keyed by fromColumn in the
      // resolved (pre-strip) row of `t`. Re-walk t.resolvedRows to find it
      // for each validated row.
      validated.forEach((vRow, vIdx) => {
        const rawLabel = t.resolvedRows[vIdx]?.[link.fromColumn];
        if (rawLabel == null || rawLabel === "") {
          vRow[link.fromColumn] = null;
          return;
        }
        const id = parentMap.get(String(rawLabel).trim().toLowerCase());
        vRow[link.fromColumn] = id ?? null;
      });
    }

    // 3c. Insert this target's rows. Ask for ids back so the next target
    //     can link to them.
    const { data: insertedRows, error } = await supabase
      .from(t.schema.tableName)
      .insert(validated)
      .select("*");
    if (error || !insertedRows) {
      await rollback(supabase, inserted);
      return {
        ok: false,
        error: `Insert into ${t.schema.tableName} failed: ${error?.message ?? "unknown"}`,
        rolledBack: summariseRollback(inserted),
      };
    }
    insertedByDomain[domain] = insertedRows.length;
    inserted.push({
      table: t.schema.tableName,
      ids: insertedRows.map((r) => r.id as string),
    });

    // Build a label -> uuid map keyed by every column another target might
    // link against. Cheap to over-include since we just need the right label
    // column. Use case-insensitive label keys.
    const labelMap = new Map<string, string>();
    const linkInColumns = new Set(
      apply.links.filter((l) => l.toDomain === domain).map((l) => l.toLabelColumn),
    );
    for (const r of insertedRows) {
      for (const col of linkInColumns) {
        const v = r[col];
        if (v != null && v !== "") {
          labelMap.set(String(v).trim().toLowerCase(), r.id as string);
        }
      }
    }
    insertedLabelToId.set(domain, labelMap);
  }

  return { ok: true, insertedByDomain, newLookupsCreated };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function topoSortDomains(
  domains: ImportDomain[],
  links: FkLink[],
): ImportDomain[] | null {
  // Edge: parent (toDomain) -> child (fromDomain). Sort so parents come first.
  const incoming = new Map<ImportDomain, Set<ImportDomain>>();
  for (const d of domains) incoming.set(d, new Set());
  for (const l of links) {
    if (!domains.includes(l.fromDomain) || !domains.includes(l.toDomain)) continue;
    incoming.get(l.fromDomain)!.add(l.toDomain);
  }
  const out: ImportDomain[] = [];
  const remaining = new Set(domains);
  while (remaining.size > 0) {
    const free = [...remaining].find((d) => incoming.get(d)!.size === 0);
    if (!free) return null; // cycle
    out.push(free);
    remaining.delete(free);
    for (const r of remaining) incoming.get(r)!.delete(free);
  }
  return out;
}

async function createNewLookups(args: {
  supabase: SupabaseClient;
  actorId: string;
  newLookups: NewLookupSpec[];
}): Promise<{ table: string; label: string; column: string; id: string }[]> {
  const out: { table: string; label: string; column: string; id: string }[] = [];
  for (const nl of args.newLookups) {
    const { data, error } = await args.supabase
      .from(nl.table)
      .insert({
        [nl.labelColumn]: nl.label,
        created_by: args.actorId,
        updated_by: args.actorId,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(
        `create ${nl.table} "${nl.label}": ${error?.message ?? "no data"}`,
      );
    }
    out.push({ table: nl.table, label: nl.label, column: nl.column, id: data.id });
  }
  return out;
}

function patchLookupSentinels(
  rows: Record<string, unknown>[],
  created: { label: string; column: string; id: string }[],
): void {
  const byColLabel = new Map<string, string>();
  for (const c of created) byColLabel.set(`${c.column}::${c.label}`, c.id);
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (isCreateSentinel(v)) {
        const id = byColLabel.get(`${k}::${createSentinelLabel(v)}`);
        if (id) row[k] = id;
      }
    }
  }
}

async function rollback(supabase: SupabaseClient, inserted: InsertedTrack[]) {
  // Delete in reverse insert order so FK constraints don't trip on us.
  for (let i = inserted.length - 1; i >= 0; i--) {
    const { table, ids } = inserted[i];
    if (ids.length === 0) continue;
    try {
      await supabase.from(table).delete().in("id", ids);
    } catch {
      // best effort — log via audit triggers, nothing else we can do here.
    }
  }
}

function summariseRollback(inserted: InsertedTrack[]) {
  return inserted
    .filter((x) => x.ids.length > 0)
    .map(({ table, ids }) => ({ table, count: ids.length }));
}

export { createSentinel }; // re-exported for callers that need to recognise sentinels
