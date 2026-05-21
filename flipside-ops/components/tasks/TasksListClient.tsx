"use client";

import Link from "next/link";
import { useState } from "react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import {
  ContextPanel,
  EmptyContextPanel,
} from "@/components/layout/ContextPanel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { TasksFilters } from "@/components/tasks/TasksFilters";
import { shortDate, timeAgo } from "@/lib/format";

export type TaskRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: string;
  priority_id: string | null;
  linked_client_id: string | null;
  needs_prep: boolean | null;
  private: boolean | null;
  recurrence: string | null;
  created_at: string;
};

type Person = { id: string; full_name: string | null };
type ClientRef = { id: string; name: string };

const TABS = [
  { key: "task", label: "Tasks" },
  { key: "notice", label: "Notices" },
  { key: "industry_alert", label: "Industry alerts" },
  { key: "recurring_template", label: "Recurring" },
] as const;

const statusTone = (s: string, overdue: boolean) =>
  s === "done"
    ? "success"
    : s === "cancelled"
      ? "neutral"
      : s === "in_progress"
        ? "info"
        : overdue
          ? "danger"
          : "warning";

const statusColor = (s: string, overdue: boolean) =>
  s === "done"
    ? "var(--color-status-active)"
    : overdue
      ? "var(--color-status-critical)"
      : s === "in_progress"
        ? "var(--color-brand-500)"
        : "var(--color-status-pending)";

export function TasksListClient({
  rows,
  tab,
  mine,
  q,
  people,
  clients,
  priorities,
}: {
  rows: TaskRow[];
  tab: string;
  mine?: string;
  q?: string;
  people: Person[];
  clients: ClientRef[];
  priorities: { id: string; name: string }[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const priorityMap = new Map(priorities.map((p) => [p.id, p.name]));

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedOverdue = !!(
    selected?.due_date &&
    new Date(selected.due_date) < new Date() &&
    selected.status !== "done"
  );

  const isOverdue = (r: TaskRow) =>
    !!(r.due_date && new Date(r.due_date) < new Date() && r.status !== "done");

  const columns: Column<TaskRow>[] = [
    {
      key: "title",
      header: "Title",
      sortValue: (r) => r.title,
      accessor: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{r.title}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {r.priority_id && (
              <Pill tone="neutral">
                {priorityMap.get(r.priority_id) ?? "—"}
              </Pill>
            )}
            {r.needs_prep && <Pill tone="warning">Needs prep</Pill>}
            {r.private && <Pill tone="brand">Private</Pill>}
            {r.recurrence && r.recurrence !== "none" && (
              <Pill tone="accent">{r.recurrence}</Pill>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      accessor: (r) => {
        const overdue = isOverdue(r);
        return (
          <Pill tone={statusTone(r.status, overdue)} dot>
            {r.status.replace("_", " ")}
          </Pill>
        );
      },
    },
    {
      key: "due",
      header: "Due",
      sortValue: (r) => (r.due_date ? new Date(r.due_date) : null),
      accessor: (r) => {
        if (!r.due_date) return <span className="text-muted">—</span>;
        const overdue = isOverdue(r);
        const soon =
          !overdue &&
          new Date(r.due_date).getTime() - Date.now() < 1000 * 60 * 60 * 48;
        return (
          <span
            className={
              overdue
                ? "text-danger-700 font-medium"
                : soon
                  ? "text-warning-700"
                  : "text-muted"
            }
          >
            {shortDate(r.due_date)}
          </span>
        );
      },
    },
    {
      key: "assignee",
      header: "Assignee",
      sortValue: (r) =>
        r.assigned_to ? (peopleMap.get(r.assigned_to)?.full_name ?? "") : "",
      accessor: (r) => (
        <span className="text-muted">
          {r.assigned_to
            ? (peopleMap.get(r.assigned_to)?.full_name ?? "—")
            : "—"}
        </span>
      ),
    },
    {
      key: "client",
      header: "Client",
      accessor: (r) =>
        r.linked_client_id ? (
          <Link
            href={`/clients/${r.linked_client_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-700 hover:underline"
          >
            {clientMap.get(r.linked_client_id)?.name ?? "—"}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  const context = selected ? (
    <ContextPanel>
      <ContextPanel.Header>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{selected.title}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone={statusTone(selected.status, selectedOverdue)} dot>
              {selected.status.replace("_", " ")}
            </Pill>
            {selected.priority_id && (
              <Pill tone="neutral">
                {priorityMap.get(selected.priority_id) ?? "—"}
              </Pill>
            )}
          </div>
        </div>
      </ContextPanel.Header>
      <ContextPanel.Body>
        {selected.description && (
          <DetailRow label="Description">
            <p className="whitespace-pre-wrap line-clamp-6">
              {selected.description}
            </p>
          </DetailRow>
        )}
        <DetailRow label="Due">
          {selected.due_date ? shortDate(selected.due_date) : "—"}
        </DetailRow>
        <DetailRow label="Assignee">
          {selected.assigned_to
            ? (peopleMap.get(selected.assigned_to)?.full_name ?? "—")
            : "—"}
        </DetailRow>
        <DetailRow label="Client">
          {selected.linked_client_id ? (
            <Link
              href={`/clients/${selected.linked_client_id}`}
              className="text-brand-700 hover:underline"
            >
              {clientMap.get(selected.linked_client_id)?.name ?? "—"}
            </Link>
          ) : (
            "—"
          )}
        </DetailRow>
        <DetailRow label="Created">{timeAgo(selected.created_at)}</DetailRow>
      </ContextPanel.Body>
      <ContextPanel.Footer>
        <Link
          href={`/tasks/${selected.id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Open task →
        </Link>
      </ContextPanel.Footer>
    </ContextPanel>
  ) : (
    <EmptyContextPanel description="Pick a row to preview the task." />
  );

  return (
    <ThreePaneLayout
      filters={
        <TasksFilters
          initialQ={q}
          initialMine={mine}
          tab={tab as "task" | "notice" | "industry_alert" | "recurring_template"}
        />
      }
      context={context}
      contextOpen={contextOpen}
      onContextOpenChange={setContextOpen}
      contextTitle={selected?.title ?? "Task details"}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => {
          const qs = new URLSearchParams();
          qs.set("tab", t.key);
          if (mine === "1") qs.set("mine", "1");
          if (q) qs.set("q", q);
          return (
            <Link
              key={t.key}
              href={`/tasks?${qs.toString()}`}
              className={`px-3 py-1 text-sm rounded-lg border ${
                tab === t.key
                  ? "bg-brand-500 text-white border-brand-500"
                  : "border-border-soft text-muted hover:bg-canvas"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No items"
            description="When there are some, they'll show here."
          />
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          selectedId={selectedId}
          onRowSelect={(r) => {
            setSelectedId(r.id);
            setContextOpen(true);
          }}
          getStatusColor={(r) => statusColor(r.status, isOverdue(r))}
          initialSort={{ key: "due", dir: "asc" }}
        />
      )}
    </ThreePaneLayout>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">
        {label}
      </div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}
