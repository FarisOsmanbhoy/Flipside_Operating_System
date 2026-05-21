"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Phone } from "lucide-react";
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
import { StaffFilters } from "@/components/staff/StaffFilters";
import { levelLabel, type AccessLevel } from "@/lib/access";

export type StaffRow = {
  id: string;
  full_name: string | null;
  email: string;
  access_level: AccessLevel;
  phone: string | null;
  mobile: string | null;
  department_id: string | null;
  avatar_url: string | null;
  job_title: string | null;
};

type Dept = { id: string; name: string };

const levelTone = (l: number) =>
  l >= 3 ? "brand" : l >= 2 ? "accent" : "neutral";

export function StaffListClient({
  rows,
  departments,
  initialQ,
  initialDept,
}: {
  rows: StaffRow[];
  departments: Dept[];
  initialQ?: string;
  initialDept?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.full_name ?? r.email,
      accessor: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.full_name} src={r.avatar_url} size={28} />
          <span className="font-medium">{r.full_name ?? r.email}</span>
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortValue: (r) => r.email,
      accessor: (r) => (
        <a
          href={`mailto:${r.email}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-brand-700 hover:underline"
        >
          <Mail size={14} /> {r.email}
        </a>
      ),
    },
    {
      key: "number",
      header: "Number",
      sortValue: (r) => r.mobile ?? r.phone ?? "",
      accessor: (r) => {
        const v = r.mobile ?? r.phone;
        return v ? (
          <a
            href={`tel:${v}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-muted hover:text-brand-700"
          >
            <Phone size={14} /> {v}
          </a>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: "job_title",
      header: "Job title",
      sortValue: (r) => r.job_title ?? "",
      accessor: (r) => (
        <span className="text-muted">{r.job_title ?? "—"}</span>
      ),
    },
  ];

  const context = selected ? (
    <ContextPanel>
      <ContextPanel.Header>
        <Avatar
          name={selected.full_name}
          src={selected.avatar_url}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">
            {selected.full_name ?? selected.email}
          </div>
          <div className="text-xs text-muted truncate">{selected.email}</div>
          <Pill tone={levelTone(selected.access_level)} dot className="mt-1">
            L{selected.access_level} · {levelLabel(selected.access_level)}
          </Pill>
        </div>
      </ContextPanel.Header>
      <ContextPanel.Body>
        <DetailRow label="Department">
          {selected.department_id
            ? (deptMap.get(selected.department_id) ?? "—")
            : "—"}
        </DetailRow>
        <DetailRow label="Phone">
          {selected.phone ? (
            <a
              href={`tel:${selected.phone}`}
              className="text-brand-700 hover:underline"
            >
              {selected.phone}
            </a>
          ) : (
            "—"
          )}
        </DetailRow>
        <DetailRow label="Mobile">
          {selected.mobile ? (
            <a
              href={`tel:${selected.mobile}`}
              className="text-brand-700 hover:underline"
            >
              {selected.mobile}
            </a>
          ) : (
            "—"
          )}
        </DetailRow>
        <DetailRow label="Email">
          <a
            href={`mailto:${selected.email}`}
            className="text-brand-700 hover:underline break-all"
          >
            {selected.email}
          </a>
        </DetailRow>
      </ContextPanel.Body>
      <ContextPanel.Footer>
        <Link
          href={`/staff/${selected.id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          View full profile →
        </Link>
      </ContextPanel.Footer>
    </ContextPanel>
  ) : (
    <EmptyContextPanel description="Click a row to see contact details." />
  );

  return (
    <ThreePaneLayout
      filters={
        <StaffFilters
          departments={departments}
          initialQ={initialQ}
          initialDept={initialDept}
        />
      }
      context={context}
      contextOpen={contextOpen}
      onContextOpenChange={setContextOpen}
      contextTitle={selected?.full_name ?? "Staff details"}
    >
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No staff match"
            description="Try clearing filters or check the spelling."
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
          initialSort={{ key: "name", dir: "asc" }}
          emptyState={<span className="text-muted">No staff to show</span>}
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
