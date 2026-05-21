"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Edit3 } from "lucide-react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import {
  ContextPanel,
  EmptyContextPanel,
} from "@/components/layout/ContextPanel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientsFilters } from "@/components/clients/ClientsFilters";
import { timeAgo } from "@/lib/format";

export type ClientRow = {
  id: string;
  name: string;
  location: string | null;
  important_info: string | null;
  updated_at: string;
  status_id: string | null;
  assigned_pm_id: string | null;
};

type Status = { id: string; name: string };
type Pm = { id: string; full_name: string | null; avatar_url: string | null };

const statusColor = (name?: string | null) => {
  const n = (name ?? "").toLowerCase();
  if (n === "active") return "var(--color-status-active)";
  if (n === "closed") return "var(--color-muted)";
  return "var(--color-status-pending)";
};

const statusTone = (name?: string | null) => {
  const n = (name ?? "").toLowerCase();
  if (n === "active") return "success";
  if (n === "closed") return "neutral";
  return "warning";
};

export function ClientsListClient({
  rows,
  statuses,
  pms,
  initialQ,
  initialStatus,
  canEdit,
}: {
  rows: ClientRow[];
  statuses: Status[];
  pms: Pm[];
  initialQ?: string;
  initialStatus?: string;
  canEdit: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const statusMap = new Map(statuses.map((s) => [s.id, s.name]));
  const pmMap = new Map(pms.map((p) => [p.id, p]));
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedStatus = selected?.status_id
    ? statusMap.get(selected.status_id)
    : null;
  const selectedPm = selected?.assigned_pm_id
    ? pmMap.get(selected.assigned_pm_id)
    : null;

  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      header: "Operator name",
      sortValue: (r) => r.name,
      accessor: (r) => r.name,
    },
    {
      key: "location",
      header: "Location",
      sortValue: (r) => r.location ?? "",
      accessor: (r) =>
        r.location ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPin size={12} /> {r.location}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => (r.status_id ? statusMap.get(r.status_id) : ""),
      accessor: (r) => {
        const name = r.status_id ? statusMap.get(r.status_id) : null;
        if (!name) return <span className="text-muted">—</span>;
        return (
          <Pill tone={statusTone(name)} dot>
            {name}
          </Pill>
        );
      },
    },
    {
      key: "pm",
      header: "CAM",
      accessor: (r) => {
        const pm = r.assigned_pm_id ? pmMap.get(r.assigned_pm_id) : null;
        if (!pm)
          return <span className="text-muted text-xs italic">No PM</span>;
        return (
          <span className="flex items-center gap-2">
            <Avatar
              name={pm.full_name}
              src={pm.avatar_url}
              size={22}
            />
            <span className="text-sm truncate max-w-[10rem]">
              {pm.full_name ?? "—"}
            </span>
          </span>
        );
      },
    },
    {
      key: "updated",
      header: "Last updated",
      sortValue: (r) => new Date(r.updated_at),
      accessor: (r) => (
        <span className="text-xs text-muted">{timeAgo(r.updated_at)}</span>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "",
            align: "right" as const,
            accessor: (r: ClientRow) => (
              <Link
                href={`/clients/${r.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-700"
              >
                <Edit3 size={12} /> Edit
              </Link>
            ),
          },
        ]
      : []),
  ];

  const context = selected ? (
    <ContextPanel>
      <ContextPanel.Header>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">
            {selected.name}
          </div>
          {selected.location && (
            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {selected.location}
            </div>
          )}
          {selectedStatus && (
            <Pill tone={statusTone(selectedStatus)} dot className="mt-2">
              {selectedStatus}
            </Pill>
          )}
        </div>
      </ContextPanel.Header>
      <ContextPanel.Body>
        {selected.important_info && (
          <DetailRow label="Important info">
            <p className="whitespace-pre-wrap text-sm">
              {selected.important_info}
            </p>
          </DetailRow>
        )}
        <DetailRow label="Account manager">
          {selectedPm ? (
            <span className="flex items-center gap-2">
              <Avatar
                name={selectedPm.full_name}
                src={selectedPm.avatar_url}
                size={20}
              />
              {selectedPm.full_name ?? "—"}
            </span>
          ) : (
            <span className="italic text-muted">No PM assigned</span>
          )}
        </DetailRow>
        <DetailRow label="Last updated">{timeAgo(selected.updated_at)}</DetailRow>
      </ContextPanel.Body>
      <ContextPanel.Footer>
        <Link
          href={`/clients/${selected.id}/request-change`}
          className="text-sm text-muted hover:underline"
        >
          Request change
        </Link>
        <Link
          href={`/clients/${selected.id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Open client →
        </Link>
      </ContextPanel.Footer>
    </ContextPanel>
  ) : (
    <EmptyContextPanel description="Click a client to see the snapshot here." />
  );

  return (
    <ThreePaneLayout
      filters={
        <ClientsFilters
          statuses={statuses}
          initialQ={initialQ}
          initialStatus={initialStatus}
          canEdit={canEdit}
        />
      }
      context={context}
      contextOpen={contextOpen}
      onContextOpenChange={setContextOpen}
      contextTitle={selected?.name ?? "Client details"}
    >
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients match"
            description="Try clearing filters or adjust the search."
          />
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowHref={(r) => `/clients/${r.id}`}
          selectedId={selectedId}
          onRowSelect={(r) => {
            setSelectedId(r.id);
            setContextOpen(true);
          }}
          getStatusColor={(r) =>
            statusColor(r.status_id ? statusMap.get(r.status_id) : null)
          }
          initialSort={{ key: "name", dir: "asc" }}
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
