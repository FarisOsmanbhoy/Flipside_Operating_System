"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import {
  ContextPanel,
  EmptyContextPanel,
} from "@/components/layout/ContextPanel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { ChangeRequestActions } from "@/components/clients/ChangeRequestActions";
import { cn, timeAgo } from "@/lib/format";

export type ChangeRow = {
  id: string;
  client_id: string;
  section_type_id: string | null;
  requested_by: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  decision_notes: string | null;
  created_at: string;
};

type Client = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string };
type Section = { id: string; name: string };

const STATUSES: ChangeRow["status"][] = ["pending", "approved", "rejected"];

const statusTone = (s: string) =>
  s === "pending" ? "warning" : s === "approved" ? "success" : "danger";

const statusColor = (s: string) =>
  s === "pending"
    ? "var(--color-status-pending)"
    : s === "approved"
      ? "var(--color-status-active)"
      : "var(--color-status-critical)";

export function ChangeRequestsListClient({
  rows,
  status,
  clients,
  people,
  sections,
}: {
  rows: ChangeRow[];
  status: ChangeRow["status"];
  clients: Client[];
  people: Person[];
  sections: Section[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  const setStatus = (s: ChangeRow["status"]) => {
    const next = new URLSearchParams(params.toString());
    next.set("status", s);
    start(() => router.replace(`/clients/changes?${next.toString()}`));
  };

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const columns: Column<ChangeRow>[] = [
    {
      key: "client",
      header: "Client",
      sortValue: (r) => clientMap.get(r.client_id)?.name ?? "",
      accessor: (r) => (
        <span className="font-medium">
          {clientMap.get(r.client_id)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "section",
      header: "Section",
      accessor: (r) =>
        r.section_type_id ? (
          <Pill tone="info">{sectionMap.get(r.section_type_id) ?? "—"}</Pill>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "summary",
      header: "Summary",
      accessor: (r) => (
        <span className="text-sm truncate max-w-[28rem] block">{r.summary}</span>
      ),
    },
    {
      key: "by",
      header: "Requested by",
      accessor: (r) => {
        const p = peopleMap.get(r.requested_by);
        return (
          <span className="text-muted text-sm">
            {p?.full_name ?? p?.email ?? "—"}
          </span>
        );
      },
    },
    {
      key: "when",
      header: "When",
      sortValue: (r) => new Date(r.created_at),
      accessor: (r) => (
        <span className="text-xs text-muted">{timeAgo(r.created_at)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (r) => (
        <Pill tone={statusTone(r.status)} dot>
          {r.status}
        </Pill>
      ),
    },
  ];

  const context = selected ? (
    <ContextPanel>
      <ContextPanel.Header>
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${selected.client_id}`}
            className="text-base font-semibold text-brand-700 hover:underline"
          >
            {clientMap.get(selected.client_id)?.name ?? "Unknown client"}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1">
            {selected.section_type_id && (
              <Pill tone="info">
                {sectionMap.get(selected.section_type_id) ?? "—"}
              </Pill>
            )}
            <Pill tone={statusTone(selected.status)} dot>
              {selected.status}
            </Pill>
          </div>
        </div>
      </ContextPanel.Header>
      <ContextPanel.Body>
        <DetailRow label="Summary">
          <p className="whitespace-pre-wrap text-sm">{selected.summary}</p>
        </DetailRow>
        {selected.decision_notes && (
          <DetailRow label="Decision notes">
            <p className="italic text-sm">{selected.decision_notes}</p>
          </DetailRow>
        )}
        <DetailRow label="Requested by">
          {(() => {
            const p = peopleMap.get(selected.requested_by);
            return p?.full_name ?? p?.email ?? "—";
          })()}
        </DetailRow>
        <DetailRow label="When">{timeAgo(selected.created_at)}</DetailRow>
      </ContextPanel.Body>
      {selected.status === "pending" && (
        <ContextPanel.Footer>
          <ChangeRequestActions id={selected.id} />
        </ContextPanel.Footer>
      )}
    </ContextPanel>
  ) : (
    <EmptyContextPanel description="Pick a request to review the details." />
  );

  return (
    <ThreePaneLayout
      filters={
        <div className="space-y-5">
          <div>
            <div className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
              Status
            </div>
            <ul className="space-y-1">
              {STATUSES.map((s) => {
                const active = status === s;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => setStatus(s)}
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
                          active
                            ? s === "approved"
                              ? "bg-emerald-500"
                              : s === "rejected"
                                ? "bg-danger-500"
                                : "bg-amber-500"
                            : "bg-border-soft",
                        )}
                      />
                      {s}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      }
      context={context}
      contextOpen={contextOpen}
      onContextOpenChange={setContextOpen}
      contextTitle="Change request"
    >
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing to review"
            description="No change requests with this status."
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
          getStatusColor={(r) => statusColor(r.status)}
          initialSort={{ key: "when", dir: "desc" }}
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
