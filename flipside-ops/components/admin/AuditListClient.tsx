"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, timeAgo } from "@/lib/format";

export type AuditRow = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  created_at: string;
};

type Actor = { id: string; full_name: string | null; email: string };

const actionTone = (a: string) =>
  a === "create" ? "success" : a === "delete" ? "danger" : "neutral";

export function AuditListClient({
  rows,
  actors,
}: {
  rows: AuditRow[];
  actors: Actor[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();
  const actorMap = useMemo(
    () => new Map(actors.map((a) => [a.id, a])),
    [actors],
  );

  const q = params.get("q") ?? "";
  const actionFilter = params.get("action") ?? "";
  const entityFilter = params.get("entity") ?? "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    start(() => router.replace(`/admin/audit?${next.toString()}`));
  };

  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.entity_type));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (entityFilter && r.entity_type !== entityFilter) return false;
      if (needle && !(r.summary ?? "").toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [rows, q, actionFilter, entityFilter]);

  const columns: Column<AuditRow>[] = [
    {
      key: "when",
      header: "When",
      sortValue: (r) => new Date(r.created_at),
      accessor: (r) => (
        <span className="text-xs text-muted whitespace-nowrap">
          {timeAgo(r.created_at)}
        </span>
      ),
    },
    {
      key: "who",
      header: "Who",
      accessor: (r) => {
        const a = r.actor_id ? actorMap.get(r.actor_id) : null;
        return (
          <span className="text-sm">
            {a?.full_name ?? a?.email ?? "—"}
          </span>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      sortValue: (r) => r.action,
      accessor: (r) => <Pill tone={actionTone(r.action)}>{r.action}</Pill>,
    },
    {
      key: "entity",
      header: "Entity",
      sortValue: (r) => r.entity_type,
      accessor: (r) => (
        <span className="text-xs text-muted">{r.entity_type}</span>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      accessor: (r) => (
        <span className="text-sm truncate max-w-[28rem] block">
          {r.summary ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <ThreePaneLayout
      filters={
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
              Search summary
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="search"
                defaultValue={q}
                onChange={(e) => update("q", e.target.value)}
                placeholder="Contains…"
                className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <FilterGroup label="Action">
            {[
              { key: "", label: "All actions" },
              { key: "create", label: "Create" },
              { key: "update", label: "Update" },
              { key: "delete", label: "Delete" },
            ].map((o) => (
              <FilterRow
                key={o.key}
                label={o.label}
                active={actionFilter === o.key}
                onClick={() => update("action", o.key)}
              />
            ))}
          </FilterGroup>

          {entityTypes.length > 0 && (
            <FilterGroup label="Entity">
              <FilterRow
                label="All entities"
                active={!entityFilter}
                onClick={() => update("entity", "")}
              />
              {entityTypes.map((e) => (
                <FilterRow
                  key={e}
                  label={e}
                  active={entityFilter === e}
                  onClick={() => update("entity", e)}
                />
              ))}
            </FilterGroup>
          )}
        </div>
      }
    >
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing matches"
            description="Try clearing filters."
          />
        </Card>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          initialSort={{ key: "when", dir: "desc" }}
          dense
        />
      )}
    </ThreePaneLayout>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
        {label}
      </div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function FilterRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left capitalize",
          active
            ? "bg-brand-50 text-brand-700 font-medium"
            : "text-ink hover:bg-canvas",
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            active ? "bg-brand-500" : "bg-border-soft",
          )}
        />
        {label}
      </button>
    </li>
  );
}
