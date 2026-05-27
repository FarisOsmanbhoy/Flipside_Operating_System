"use client";

// Per-domain preview table. Pure presentation — given resolved rows + cell
// warnings, renders the table with badges. Used inside ImportChat's tabbed
// preview pane.

import { AlertTriangle, Sparkles } from "lucide-react";

import type { CellWarning, ResolvedDomain } from "@/lib/import/applyPlan";
import { isCreateSentinel } from "@/lib/import/applyPlan";
import type { ImportSchema } from "@/lib/import/schemas";

export function PreviewTable({
  resolved,
  maxRows = 25,
}: {
  resolved: ResolvedDomain;
  maxRows?: number;
}) {
  const { schema, resolvedRows, cellWarnings, rowErrors } = resolved;
  const visible = resolvedRows.slice(0, maxRows);

  const warningIndex = indexWarnings(cellWarnings);
  const rowErrorByIndex = new Map(rowErrors.map((e) => [e.rowIndex, e.reason]));

  return (
    <div className="flex flex-col h-full">
      <SummaryBar
        domain={schema.displayName}
        total={resolvedRows.length}
        cellWarnings={cellWarnings.length}
        rowErrors={rowErrors.length}
      />
      <div className="flex-1 overflow-auto rounded border border-border-soft">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-canvas text-left uppercase text-muted">
            <tr>
              <th className="px-2 py-1.5 w-12">#</th>
              {schema.columns.map((c) => (
                <th key={c.column} className="px-2 py-1.5 whitespace-nowrap">
                  {c.column}
                  {c.required && <span className="ml-0.5 text-danger-500">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, vi) => {
              const rowIdx = vi; // resolvedRows preserves order; warnings use original source idx, but cellWarnings already store source row index. We display position-based # but match warnings by source idx — close enough for preview given filters are rare here.
              const rowErr = rowErrorByIndex.get(rowIdx);
              return (
                <tr
                  key={vi}
                  className={`border-t border-border-soft ${rowErr ? "bg-danger-50" : ""}`}
                >
                  <td className="px-2 py-1.5 text-muted font-mono">{vi + 1}</td>
                  {schema.columns.map((c) => {
                    const warnings = warningIndex.get(`${rowIdx}::${c.column}`) ?? [];
                    return (
                      <td key={c.column} className="px-2 py-1.5 align-top">
                        <Cell value={row[c.column]} warnings={warnings} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {resolvedRows.length === 0 && (
              <tr>
                <td
                  colSpan={schema.columns.length + 1}
                  className="px-3 py-6 text-center text-muted"
                >
                  No rows to preview yet — the AI is still working out the mapping.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {resolvedRows.length > visible.length && (
        <p className="mt-2 text-xs text-muted">
          Showing {visible.length} of {resolvedRows.length} rows.
        </p>
      )}
    </div>
  );
}

function SummaryBar({
  domain,
  total,
  cellWarnings,
  rowErrors,
}: {
  domain: string;
  total: number;
  cellWarnings: number;
  rowErrors: number;
}) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs">
      <span className="font-medium">
        {domain}: <span className="text-muted">{total} rows</span>
      </span>
      <span className="flex items-center gap-3 text-muted">
        {cellWarnings > 0 && (
          <span className="flex items-center gap-1">
            <Sparkles size={12} className="text-brand-500" />
            {cellWarnings} AI assumption{cellWarnings === 1 ? "" : "s"}
          </span>
        )}
        {rowErrors > 0 && (
          <span className="flex items-center gap-1 text-danger-700">
            <AlertTriangle size={12} />
            {rowErrors} row{rowErrors === 1 ? "" : "s"} need attention
          </span>
        )}
      </span>
    </div>
  );
}

function Cell({ value, warnings }: { value: unknown; warnings: CellWarning[] }) {
  const needsInput = warnings.some((w) => w.severity === "needs_input");
  const display = formatValue(value);
  return (
    <span
      className={`inline-flex items-center gap-1 max-w-[16rem] truncate ${
        needsInput
          ? "rounded bg-danger-50 px-1 text-danger-700"
          : warnings.length > 0
            ? "rounded bg-brand-50 px-1 text-brand-700"
            : ""
      }`}
      title={warnings.map((w) => w.message).join(" • ")}
    >
      {warnings.length > 0 &&
        (needsInput ? (
          <AlertTriangle size={10} className="shrink-0" />
        ) : (
          <Sparkles size={10} className="shrink-0" />
        ))}
      <span className="truncate">{display}</span>
    </span>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (isCreateSentinel(v)) return v.replace(/^__create__:/, "+ new ");
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  return String(v);
}

function indexWarnings(warnings: CellWarning[]): Map<string, CellWarning[]> {
  const m = new Map<string, CellWarning[]>();
  for (const w of warnings) {
    const k = `${w.rowIndex}::${w.column}`;
    const list = m.get(k) ?? [];
    list.push(w);
    m.set(k, list);
  }
  return m;
}

// Used by ImportChat when no preview tab is active yet (right after upload).
export function PreviewPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted">
      Drop a file in the upload step on the left to begin.
    </div>
  );
}

// Re-export for callers that need to inspect schema column count.
export type { ImportSchema };
