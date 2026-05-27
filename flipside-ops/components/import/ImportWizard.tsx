"use client";

// Multi-step AI-assisted import wizard.
//
// Steps:
//   1. Upload      — pick a .xlsx / .csv, server parses to headers + rows
//   2. Map         — AI proposes excelHeader -> dbColumn, admin can override
//   3. Resolve     — fetch existing lookup rows + show choices for unmatched
//   4. Preview     — final resolved rows, with row-level Zod errors flagged
//   5. Commit      — server-side validate + batch insert; show result
//
// We keep ALL parsed rows in client component state, not on the server,
// so the import is stateless across serverless instances.

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

import {
  importParseSpreadsheet,
  importProposeMapping,
  importResolveLookups,
  importCommit,
  type LookupResultDTO,
} from "@/lib/import/actions";
import {
  IMPORT_COLUMNS,
  type ImportDomain,
  type ImportColumnLite,
} from "./columns";

type Step = "upload" | "map" | "resolve" | "preview" | "commit" | "done";

type Mapping = {
  excelHeader: string;
  dbColumn: string | null;
  confidence: number;
  reason: string;
};

type LookupChoice = {
  // resolution: existing id | "__create__:<label>" | "__skip__"
  resolution: string;
};

type CommitResult = {
  inserted: number;
  failed: { row: number; reason: string }[];
};

export function ImportWizard({
  domain,
  open,
  onClose,
}: {
  domain: ImportDomain;
  open: boolean;
  onClose: () => void;
}) {
  const targetColumns = IMPORT_COLUMNS[domain];
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [unmappedConcerns, setUnmappedConcerns] = useState<string[]>([]);

  const [lookupResults, setLookupResults] = useState<LookupResultDTO[]>([]);
  // key = `${dbColumn}::${rawValue}` -> chosen resolution string
  const [lookupChoices, setLookupChoices] = useState<Record<string, LookupChoice>>({});

  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  // ───── derived ─────
  const finalMapping = useMemo(
    () => mapping.filter((m) => m.dbColumn && m.dbColumn !== "__skip__"),
    [mapping],
  );

  // ───── handlers ─────
  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await importParseSpreadsheet(domain, fd);
        if (!res.ok) {
          setError(res.error);
          setBusy(false);
          return;
        }
        setHeaders(res.headers);
        setRows(res.rows);

        // Immediately ask the AI to propose a mapping.
        const proposal = await importProposeMapping({
          domain,
          headers: res.headers,
          sampleRows: res.sampleRows,
        });
        if (!proposal.ok) {
          setError(proposal.error);
          setBusy(false);
          return;
        }
        setAiUsed(proposal.aiUsed);
        if (!proposal.aiUsed) {
          setAiNotice("AI unavailable — manual mapping. Adjust columns below.");
        }
        setMapping(
          proposal.data.mapping.map((m) => ({
            excelHeader: m.excelHeader,
            dbColumn: m.dbColumn,
            confidence: m.confidence,
            reason: m.reason,
          })),
        );
        setUnmappedConcerns(proposal.data.unmappedConcerns);
        setStep("map");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [domain],
  );

  const handleProceedToResolve = useCallback(async () => {
    setError(null);

    // Required-column gate.
    const required = targetColumns.filter((c) => c.required).map((c) => c.column);
    const mapped = new Set(finalMapping.map((m) => m.dbColumn!));
    const missing = required.filter((c) => !mapped.has(c));
    if (missing.length > 0) {
      setError(`Required columns not mapped: ${missing.join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      const res = await importResolveLookups({
        domain,
        mapping: finalMapping.map((m) => ({
          excelHeader: m.excelHeader,
          dbColumn: m.dbColumn!,
        })),
        rows,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLookupResults(res.results);
      // Pre-fill choices for matched values; leave unmatched blank.
      const defaults: Record<string, LookupChoice> = {};
      for (const r of res.results) {
        for (const v of r.values) {
          if (v.match) {
            defaults[`${r.column}::${v.rawValue}`] = { resolution: v.match.id };
          }
        }
      }
      setLookupChoices(defaults);

      // Skip resolve step if there's nothing to resolve.
      const anyUnresolved = res.results.some((r) =>
        r.values.some((v) => !v.match),
      );
      setStep(anyUnresolved ? "resolve" : "preview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [domain, finalMapping, rows, targetColumns]);

  const handleCommit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      // Build the resolved-row payload keyed by dbColumn.
      const newLookups: {
        table: string;
        labelColumn: string;
        label: string;
        column: string;
      }[] = [];
      const seenNewLookup = new Set<string>(); // `${table}|${label}|${column}`

      const resolvedRows = rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const m of finalMapping) {
          const raw = row[m.excelHeader];
          const dbCol = m.dbColumn!;
          const colDef = targetColumns.find((c) => c.column === dbCol);
          if (!colDef) continue;

          if (colDef.lookup) {
            const key = `${dbCol}::${raw == null ? "" : String(raw).trim()}`;
            const choice = lookupChoices[key];
            if (raw == null || String(raw).trim() === "") {
              out[dbCol] = null;
            } else if (!choice) {
              out[dbCol] = null;
            } else if (choice.resolution.startsWith("__create__:")) {
              const label = choice.resolution.slice("__create__:".length);
              const lookupKey = `${colDef.lookup.table}|${label}|${dbCol}`;
              if (!seenNewLookup.has(lookupKey)) {
                seenNewLookup.add(lookupKey);
                newLookups.push({
                  table: colDef.lookup.table,
                  labelColumn: colDef.lookup.labelColumn,
                  label,
                  column: dbCol,
                });
              }
              out[dbCol] = choice.resolution; // sentinel, server patches it
            } else if (choice.resolution === "__skip__") {
              out[dbCol] = null;
            } else {
              out[dbCol] = choice.resolution; // existing uuid
            }
          } else {
            // Scalar column. Coerce blanks to null.
            if (raw == null) {
              out[dbCol] = null;
            } else {
              const s = typeof raw === "string" ? raw.trim() : raw;
              out[dbCol] = s === "" ? null : s;
            }
          }
        }
        return out;
      });

      const res = await importCommit({
        domain,
        rows: resolvedRows,
        newLookups,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCommitResult({ inserted: res.inserted, failed: res.failed });
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [domain, rows, finalMapping, lookupChoices, targetColumns]);

  // ───── render ─────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Import ${domain}`}
      maxWidth="max-w-4xl"
    >
      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aiNotice && step === "map" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border-soft bg-canvas px-3 py-2 text-sm text-muted">
          <Sparkles size={14} className="mt-0.5 shrink-0" /> {aiNotice}
        </div>
      )}

      {step === "upload" && (
        <UploadStep busy={busy} onPick={handleUpload} />
      )}

      {step === "map" && (
        <MapStep
          headers={headers}
          mapping={mapping}
          targetColumns={targetColumns}
          aiUsed={aiUsed}
          unmappedConcerns={unmappedConcerns}
          onChange={(idx, dbColumn) =>
            setMapping((prev) =>
              prev.map((m, i) =>
                i === idx ? { ...m, dbColumn, confidence: 1, reason: "manual" } : m,
              ),
            )
          }
          onProceed={handleProceedToResolve}
          busy={busy}
          onCancel={onClose}
        />
      )}

      {step === "resolve" && (
        <ResolveStep
          lookupResults={lookupResults}
          choices={lookupChoices}
          onChange={(key, resolution) =>
            setLookupChoices((prev) => ({ ...prev, [key]: { resolution } }))
          }
          onProceed={() => setStep("preview")}
          onBack={() => setStep("map")}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          rows={rows}
          mapping={finalMapping}
          onBack={() => setStep(lookupResults.length ? "resolve" : "map")}
          onCommit={handleCommit}
          busy={busy}
        />
      )}

      {step === "done" && commitResult && (
        <DoneStep result={commitResult} onClose={onClose} />
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-steps
// ─────────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map" },
    { id: "resolve", label: "Resolve" },
    { id: "preview", label: "Preview" },
    { id: "done", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <div className="mb-5 flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const isPast = i < idx;
        const isCurrent = i === idx;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                isCurrent
                  ? "border-brand-500 bg-brand-500 text-white"
                  : isPast
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border-soft text-muted"
              }`}
            >
              {isPast ? <Check size={12} /> : <span>{i + 1}</span>}
            </div>
            <span className={isCurrent ? "font-medium" : "text-muted"}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-border-soft" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadStep({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <FileSpreadsheet size={48} className="text-muted" />
      <div className="text-center">
        <p className="text-sm font-medium">Upload an Excel (.xlsx) or CSV file</p>
        <p className="mt-1 text-xs text-muted">
          Max 2 MB, 1,000 rows. First sheet only. First row is treated as headers.
        </p>
      </div>
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        <span
          className={`inline-flex items-center gap-2 rounded-lg border border-border-soft bg-surface px-4 py-2 text-sm hover:bg-canvas ${
            busy ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Parsing + asking AI…" : "Choose file"}
        </span>
      </label>
    </div>
  );
}

function MapStep({
  headers,
  mapping,
  targetColumns,
  aiUsed,
  unmappedConcerns,
  onChange,
  onProceed,
  busy,
  onCancel,
}: {
  headers: string[];
  mapping: Mapping[];
  targetColumns: ImportColumnLite[];
  aiUsed: boolean;
  unmappedConcerns: string[];
  onChange: (idx: number, dbColumn: string | null) => void;
  onProceed: () => void;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {aiUsed ? (
          <>
            <Sparkles size={14} className="-mt-0.5 mr-1 inline" />
            AI proposed mappings below — adjust any that look wrong.
          </>
        ) : (
          <>Set each Excel column to the matching database field.</>
        )}
      </p>

      {unmappedConcerns.length > 0 && (
        <ul className="mb-3 list-disc rounded border border-border-soft bg-canvas px-5 py-2 text-xs text-muted">
          {unmappedConcerns.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}

      <div className="max-h-[40vh] overflow-y-auto rounded border border-border-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Excel column</th>
              <th className="px-3 py-2">Maps to</th>
              <th className="px-3 py-2 w-24">Confidence</th>
              <th className="px-3 py-2">AI reasoning</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const m = mapping[i] ?? { dbColumn: null, confidence: 0, reason: "" };
              return (
                <tr key={i} className="border-t border-border-soft">
                  <td className="px-3 py-2 font-mono text-xs">{h}</td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded border border-border-soft bg-surface px-2 py-1 text-sm"
                      value={m.dbColumn ?? ""}
                      onChange={(e) =>
                        onChange(i, e.target.value === "" ? null : e.target.value)
                      }
                    >
                      <option value="">— skip —</option>
                      {targetColumns.map((c) => (
                        <option key={c.column} value={c.column}>
                          {c.column}
                          {c.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <ConfidencePill value={m.confidence} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{m.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onProceed} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Next: Resolve lookups
        </Button>
      </div>
    </div>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value === 0
      ? "bg-border-soft text-muted"
      : value < 0.7
        ? "bg-accent-100 text-accent-700"
        : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${tone}`}>
      {value === 0 ? "—" : `${pct}%`}
    </span>
  );
}

function ResolveStep({
  lookupResults,
  choices,
  onChange,
  onProceed,
  onBack,
}: {
  lookupResults: LookupResultDTO[];
  choices: Record<string, LookupChoice>;
  onChange: (key: string, resolution: string) => void;
  onProceed: () => void;
  onBack: () => void;
}) {
  const totalUnresolved = lookupResults.reduce(
    (n, r) => n + r.values.filter((v) => !v.match).length,
    0,
  );

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {totalUnresolved > 0 ? (
          <>
            {totalUnresolved} unmatched value
            {totalUnresolved === 1 ? "" : "s"} need a decision. Pick an existing
            row, create a new one (if allowed), or skip to leave the field blank.
          </>
        ) : (
          <>All lookup values matched existing rows — nothing to resolve.</>
        )}
      </p>

      {lookupResults.map((r) => (
        <div key={r.column} className="mb-4">
          <h4 className="mb-2 text-xs font-medium uppercase text-muted">
            {r.column} <span className="font-normal">({r.table})</span>
          </h4>
          <div className="rounded border border-border-soft">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Raw value</th>
                  <th className="px-3 py-2">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {r.values.map((v) => {
                  const key = `${r.column}::${v.rawValue}`;
                  const current = choices[key]?.resolution ?? "";
                  return (
                    <tr key={key} className="border-t border-border-soft">
                      <td className="px-3 py-2 font-mono text-xs">
                        {v.rawValue}
                        {v.match && (
                          <span className="ml-2 text-muted">
                            (auto: {v.match.label})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded border border-border-soft bg-surface px-2 py-1 text-sm"
                          value={current}
                          onChange={(e) => onChange(key, e.target.value)}
                        >
                          <option value="">— pick —</option>
                          {v.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                          {v.canCreate && (
                            <option value={`__create__:${v.rawValue}`}>
                              + Create new “{v.rawValue}”
                            </option>
                          )}
                          <option value="__skip__">— leave blank —</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onProceed}>Next: Preview</Button>
      </div>
    </div>
  );
}

function PreviewStep({
  rows,
  mapping,
  onBack,
  onCommit,
  busy,
}: {
  rows: Record<string, unknown>[];
  mapping: Mapping[];
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
}) {
  const preview = rows.slice(0, 10);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        About to insert <strong>{rows.length}</strong> rows. First {preview.length}{" "}
        previewed below. Audit log will record every row.
      </p>

      <div className="max-h-[40vh] overflow-auto rounded border border-border-soft">
        <table className="w-full text-xs">
          <thead className="bg-canvas text-left uppercase text-muted">
            <tr>
              <th className="px-2 py-1.5">#</th>
              {mapping.map((m) => (
                <th key={m.excelHeader} className="px-2 py-1.5">
                  {m.dbColumn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-t border-border-soft">
                <td className="px-2 py-1.5 text-muted">{i + 1}</td>
                {mapping.map((m) => (
                  <td key={m.excelHeader} className="px-2 py-1.5 font-mono">
                    {formatCell(row[m.excelHeader])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={onCommit} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Importing…" : `Import ${rows.length} rows`}
        </Button>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  return String(v);
}

function DoneStep({
  result,
  onClose,
}: {
  result: CommitResult;
  onClose: () => void;
}) {
  const allOk = result.failed.length === 0;
  return (
    <div className="py-4">
      <div className="mb-4 flex items-center gap-3">
        {allOk ? (
          <CheckCircle2 size={32} className="text-brand-500" />
        ) : (
          <AlertCircle size={32} className="text-accent-500" />
        )}
        <div>
          <p className="font-medium">
            Imported {result.inserted} row{result.inserted === 1 ? "" : "s"}
            {result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}
            .
          </p>
          <p className="text-xs text-muted">
            Audit log shows every inserted row.
          </p>
        </div>
      </div>

      {result.failed.length > 0 && (
        <div className="mb-4 max-h-48 overflow-y-auto rounded border border-border-soft text-xs">
          <table className="w-full">
            <thead className="bg-canvas">
              <tr>
                <th className="px-2 py-1.5 text-left">Row</th>
                <th className="px-2 py-1.5 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.failed.map((f) => (
                <tr key={f.row} className="border-t border-border-soft">
                  <td className="px-2 py-1.5 font-mono">{f.row}</td>
                  <td className="px-2 py-1.5">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose}>
          <X size={16} /> Close
        </Button>
      </div>
    </div>
  );
}
