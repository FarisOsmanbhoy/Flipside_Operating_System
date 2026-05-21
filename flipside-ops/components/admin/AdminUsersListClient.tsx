"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserContextPanel } from "@/components/admin/UserContextPanel";
import { LEVEL_LABELS } from "@/lib/access";
import { cn } from "@/lib/format";
import type { Profile } from "@/lib/database.types";

type Dept = { id: string; name: string };

const levelTone = (l: number) =>
  l >= 3 ? "brand" : l >= 2 ? "accent" : "neutral";

const statusColor = (active: boolean) =>
  active ? "var(--color-status-active)" : "var(--color-status-critical)";

export function AdminUsersListClient({
  users,
  departments,
  currentUserId,
}: {
  users: Profile[];
  departments: Dept[];
  currentUserId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const q = params.get("q") ?? "";
  const levelFilter = params.get("level") ?? "";
  const deptFilter = params.get("dept") ?? "";
  const statusFilter = params.get("status") ?? "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`/admin/users?${next.toString()}`));
  };

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return users.filter((u) => {
      if (levelFilter && String(u.access_level) !== levelFilter) return false;
      if (deptFilter && u.department_id !== deptFilter) return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (needle) {
        return (
          (u.full_name ?? "").toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [users, q, levelFilter, deptFilter, statusFilter]);

  const selected = filtered.find((u) => u.id === selectedId) ?? null;

  const columns: Column<Profile>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.full_name ?? r.email,
      accessor: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.full_name} src={r.avatar_url} size={26} />
          <span className="font-medium">{r.full_name ?? r.email}</span>
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortValue: (r) => r.email,
      accessor: (r) => <span className="text-muted">{r.email}</span>,
    },
    {
      key: "level",
      header: "Level",
      sortValue: (r) => r.access_level,
      accessor: (r) => (
        <Pill tone={levelTone(r.access_level)} dot>
          L{r.access_level} · {LEVEL_LABELS[r.access_level]}
        </Pill>
      ),
    },
    {
      key: "dept",
      header: "Department",
      accessor: (r) => (
        <span className="text-muted">
          {r.department_id ? (deptMap.get(r.department_id) ?? "—") : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => (r.is_active ? 1 : 0),
      accessor: (r) =>
        r.is_active ? (
          <Pill tone="success" dot>
            Active
          </Pill>
        ) : (
          <Pill tone="danger" dot>
            Inactive
          </Pill>
        ),
    },
  ];

  return (
    <ThreePaneLayout
      filters={
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
              Search
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
                placeholder="Name or email…"
                className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <FilterGroup label="Access level">
            {[
              { key: "", label: "All levels" },
              { key: "3", label: "Level 3 — Admin" },
              { key: "2", label: "Level 2 — Manager" },
              { key: "1", label: "Level 1 — Editor" },
            ].map((o) => (
              <FilterRow
                key={o.key}
                label={o.label}
                active={levelFilter === o.key}
                onClick={() => update("level", o.key)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Department">
            <FilterRow
              label="All departments"
              active={!deptFilter}
              onClick={() => update("dept", "")}
            />
            {departments.map((d) => (
              <FilterRow
                key={d.id}
                label={d.name}
                active={deptFilter === d.id}
                onClick={() => update("dept", d.id)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            {[
              { key: "", label: "All" },
              { key: "active", label: "Active" },
              { key: "inactive", label: "Inactive" },
            ].map((o) => (
              <FilterRow
                key={o.key}
                label={o.label}
                active={statusFilter === o.key}
                onClick={() => update("status", o.key)}
              />
            ))}
          </FilterGroup>
        </div>
      }
      context={
        <UserContextPanel
          user={selected}
          departments={departments}
          currentUserId={currentUserId}
        />
      }
      contextOpen={contextOpen}
      onContextOpenChange={setContextOpen}
      contextTitle={selected?.full_name ?? "User details"}
    >
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No users match"
            description="Try clearing filters."
          />
        </Card>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          selectedId={selectedId}
          onRowSelect={(r) => {
            setSelectedId(r.id);
            setContextOpen(true);
          }}
          getStatusColor={(r) => statusColor(r.is_active)}
          initialSort={{ key: "name", dir: "asc" }}
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
          "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left",
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
