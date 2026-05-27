"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";

import { dismissFinding, markActed, runDiagnostics } from "./actions";

type FindingRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  issue_type: string;
  severity: string;
  suggestion: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  dismissed_at: string | null;
  acted_at: string | null;
};

export function DiagnosticsClient({
  findings,
  nameMap,
}: {
  findings: FindingRow[];
  nameMap: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState<{
    domain: string;
    newFindings: number;
    totalRowsScanned: number;
    costUsd: number;
    stoppedEarly: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = (domain: "clients" | "suppliers") => {
    setError(null);
    setLastRun(null);
    startTransition(async () => {
      try {
        const res = await runDiagnostics({ domain });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setLastRun({
          domain,
          newFindings: res.newFindings,
          totalRowsScanned: res.totalRowsScanned,
          costUsd: res.costUsd,
          stoppedEarly: res.stoppedEarly,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      try {
        await dismissFinding(id);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleActed = (id: string) => {
    startTransition(async () => {
      try {
        await markActed(id);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const grouped: Record<string, FindingRow[]> = {};
  for (const f of findings) {
    grouped[f.entity_type] = grouped[f.entity_type] ?? [];
    grouped[f.entity_type].push(f);
  }
  const groups = Object.keys(grouped).sort();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-canvas p-3">
        <Sparkles size={16} className="text-brand-500" />
        <span className="text-sm font-medium">Run scan</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRun("clients")}
          disabled={pending}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          Clients
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRun("suppliers")}
          disabled={pending}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          Suppliers
        </Button>
        <span className="ml-auto text-xs text-muted">
          Hard cost cap: $0.20 per scan.
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastRun && (
        <div className="mb-4 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm">
          Scanned {lastRun.totalRowsScanned} {lastRun.domain} rows →{" "}
          <strong>{lastRun.newFindings} new finding{lastRun.newFindings === 1 ? "" : "s"}</strong>{" "}
          (${lastRun.costUsd.toFixed(4)} of $0.20 cap
          {lastRun.stoppedEarly ? "; stopped at cost cap" : ""}).
        </div>
      )}

      {findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-soft px-6 py-10 text-center text-sm text-muted">
          No open findings. Run a scan above to surface data-quality issues.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted">
              {group}s ({grouped[group].length})
            </h2>
            <div className="rounded-lg border border-border-soft">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Suggestion</th>
                    <th className="px-3 py-2 w-44 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[group].map((f) => (
                    <FindingRow
                      key={f.id}
                      f={f}
                      name={nameMap[`${f.entity_type}:${f.entity_id}`]}
                      pending={pending}
                      onDismiss={() => handleDismiss(f.id)}
                      onActed={() => handleActed(f.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FindingRow({
  f,
  name,
  pending,
  onDismiss,
  onActed,
}: {
  f: FindingRow;
  name: string | undefined;
  pending: boolean;
  onDismiss: () => void;
  onActed: () => void;
}) {
  const href =
    f.entity_type === "client"
      ? `/clients/${f.entity_id}`
      : f.entity_type === "supplier"
        ? `/suppliers/${f.entity_id}`
        : null;
  return (
    <tr className="border-t border-border-soft align-top">
      <td className="px-3 py-2 font-medium">
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 hover:underline"
          >
            {name ?? f.entity_id.slice(0, 8)}
            <ExternalLink size={12} />
          </Link>
        ) : (
          (name ?? f.entity_id.slice(0, 8))
        )}
      </td>
      <td className="px-3 py-2">
        <IssuePill type={f.issue_type} severity={f.severity} />
        {f.payload?.field ? (
          <span className="ml-2 font-mono text-xs text-muted">
            {String(f.payload.field)}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-sm">{f.suggestion}</td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={onActed}
          disabled={pending || !!f.acted_at}
          title="Mark as acted on (keeps history)"
        >
          <Check size={14} /> {f.acted_at ? "Acted" : "Acted"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={pending}
          title="Dismiss — not actually an issue"
        >
          <X size={14} /> Dismiss
        </Button>
      </td>
    </tr>
  );
}

function IssuePill({ type, severity }: { type: string; severity: string }) {
  const tone =
    severity === "warn"
      ? "bg-accent-100 text-accent-700"
      : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {type}
    </span>
  );
}
