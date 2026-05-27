"use client";

// Chat-driven import workspace.
//
// Layout:  [ chat | tabbed preview ]
//
// Phases (no hard gates, all visible in the same modal):
//   - "upload":    file picker. On submit -> parse -> initial plan -> first AI turn.
//   - "chatting":  split-pane workspace. User can talk to AI and/or hit Import any time.
//   - "done":      summary of what was inserted.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
// ImportButton conditionally renders this with `{open && <ImportChat ... />}`,
// so the component remounts (and state resets) every time the user opens it.
// No reset effect needed.
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

import {
  importParseSpreadsheet,
  importInitialPlan,
  importChatTurn,
  importAcceptCrossDomainTarget,
  importCommit,
  type CommitResult,
} from "@/lib/import/actions";
import { applyPlan } from "@/lib/import/applyPlan";
import {
  type ChatMessage,
  type PlanState,
  IMPORT_CHAT_COST_CAP_USD,
} from "@/lib/import/planState";
import {
  type ImportDomain,
  listImportDomains,
  getImportSchema,
} from "@/lib/import/schemas";

import { PreviewPlaceholder, PreviewTable } from "./PreviewTable";

type Phase = "upload" | "chatting" | "done";

export function ImportChat({
  domain,
  open,
  onClose,
}: {
  domain: ImportDomain;
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PlanState | null>(null);
  const [activeTab, setActiveTab] = useState<ImportDomain>(domain);
  const [draft, setDraft] = useState("");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  // ─── Upload + first turn ────────────────────────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const parsed = await importParseSpreadsheet(domain, fd);
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        const init = await importInitialPlan({
          domain,
          headers: parsed.headers,
          rows: parsed.rows,
        });
        if (!init.ok) {
          setError(init.error);
          return;
        }
        // First AI turn: empty userText, isFirstTurn=true.
        const turn = await importChatTurn({
          state: init.state,
          userText: "",
          isFirstTurn: true,
        });
        if (!turn.ok) {
          // Still let the user into the workspace — manual mode is OK.
          setState(init.state);
          setPhase("chatting");
          setError(turn.error);
          return;
        }
        setState(turn.state);
        setPhase("chatting");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [domain],
  );

  // ─── User chat turn ────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!state || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await importChatTurn({
        state,
        userText: draft.trim(),
        isFirstTurn: false,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState(res.state);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [state, draft]);

  // ─── Cross-domain accept ───────────────────────────────────────────
  const acceptCrossDomain = useCallback(
    async (target: ImportDomain) => {
      if (!state) return;
      setBusy(true);
      setError(null);
      try {
        const res = await importAcceptCrossDomainTarget({ state, domain: target });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setState(res.state);
        setActiveTab(target);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [state],
  );

  // ─── Commit ────────────────────────────────────────────────────────
  const handleCommit = useCallback(async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await importCommit({ state });
      setCommitResult(res);
      if (res.ok) setPhase("done");
      else if (res.validationFailures) {
        setError(
          `${res.validationFailures.length} row(s) need fixing before import — see the preview's red highlights, or tell the AI what to do.`,
        );
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title={`Import ${domain}`} maxWidth="max-w-6xl">
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded border border-danger-500 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {phase === "upload" && <UploadStep busy={busy} onPick={handleUpload} />}

      {phase === "chatting" && state && (
        <ChatWorkspace
          state={state}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onSend={sendMessage}
          onAcceptCrossDomain={acceptCrossDomain}
          onCommit={handleCommit}
          onCancel={onClose}
        />
      )}

      {phase === "done" && commitResult?.ok && (
        <DoneStep result={commitResult} onClose={onClose} />
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Upload step
// ─────────────────────────────────────────────────────────────────────

function UploadStep({ busy, onPick }: { busy: boolean; onPick: (f: File) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <FileSpreadsheet size={48} className="text-muted" />
      <div className="text-center">
        <p className="text-sm font-medium">Upload an Excel (.xlsx) or CSV file</p>
        <p className="mt-1 text-xs text-muted">
          Max 2 MB, 1,000 rows. The AI will figure out the rest — any format works.
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
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? "Parsing + asking AI…" : "Choose file"}
        </span>
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Chat workspace (split pane)
// ─────────────────────────────────────────────────────────────────────

function ChatWorkspace({
  state,
  activeTab,
  setActiveTab,
  draft,
  setDraft,
  busy,
  onSend,
  onAcceptCrossDomain,
  onCommit,
  onCancel,
}: {
  state: PlanState;
  activeTab: ImportDomain;
  setActiveTab: (d: ImportDomain) => void;
  draft: string;
  setDraft: (s: string) => void;
  busy: boolean;
  onSend: () => void;
  onAcceptCrossDomain: (d: ImportDomain) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const apply = useMemo(() => applyPlan(state), [state]);

  // Pending cross-domain proposals (encoded in warnings; see actions.applyMutations).
  const proposals = useMemo(() => {
    return state.warnings
      .filter((w) => w.source === "ai" && w.message.startsWith("__propose__:"))
      .map((w) => {
        const rest = w.message.slice("__propose__:".length);
        const firstColon = rest.indexOf(":");
        const domain = rest.slice(0, firstColon) as ImportDomain;
        return { domain, reason: rest.slice(rest.lastIndexOf(":") + 1) };
      })
      .filter(
        (p) =>
          listImportDomains().includes(p.domain) &&
          !Object.keys(state.targets).includes(p.domain),
      );
  }, [state]);

  const activeTargets = Object.keys(state.targets) as ImportDomain[];
  const totalRows = activeTargets.reduce(
    (n, d) => n + (apply.byDomain[d]?.resolvedRows.length ?? 0),
    0,
  );
  const totalRowErrors = activeTargets.reduce(
    (n, d) => n + (apply.byDomain[d]?.rowErrors.length ?? 0),
    0,
  );
  const costPct = Math.min(100, (state.costUsdSpent / IMPORT_CHAT_COST_CAP_USD) * 100);

  return (
    <div className="grid grid-cols-[minmax(280px,1fr)_2fr] gap-4 min-h-[55vh]">
      {/* ── chat pane ── */}
      <div className="flex flex-col rounded border border-border-soft bg-canvas">
        <ChatTranscript
          messages={state.transcript}
          proposals={proposals}
          onAcceptProposal={onAcceptCrossDomain}
          busy={busy}
        />
        <div className="border-t border-border-soft p-2">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              onSend();
            }}
            className="flex gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tell the AI what you want — e.g. 'default status to Active' or 'also import the supplier columns'"
              rows={2}
              disabled={busy}
              className="flex-1 resize-none rounded border border-border-soft bg-surface px-2 py-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button type="submit" disabled={busy || !draft.trim()} size="sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </form>
          <CostBar pct={costPct} spent={state.costUsdSpent} />
        </div>
      </div>

      {/* ── preview pane ── */}
      <div className="flex flex-col rounded border border-border-soft p-3">
        <TabBar
          active={activeTab}
          setActive={setActiveTab}
          targets={activeTargets}
          counts={Object.fromEntries(
            activeTargets.map((d) => [d, apply.byDomain[d]?.resolvedRows.length ?? 0]),
          )}
        />
        <div className="flex-1 min-h-0 mt-2">
          {apply.byDomain[activeTab] ? (
            <PreviewTable resolved={apply.byDomain[activeTab]!} />
          ) : (
            <PreviewPlaceholder />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={busy} size="sm">
            Cancel
          </Button>
          <Button onClick={onCommit} disabled={busy || totalRows === 0}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Import {totalRows} row{totalRows === 1 ? "" : "s"}
            {totalRowErrors > 0 && (
              <span className="ml-1 text-xs opacity-80">
                ({totalRowErrors} need attention)
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatTranscript({
  messages,
  proposals,
  onAcceptProposal,
  busy,
}: {
  messages: ChatMessage[];
  proposals: { domain: ImportDomain; reason: string }[];
  onAcceptProposal: (d: ImportDomain) => void;
  busy: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, proposals.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
      {messages.length === 0 && (
        <p className="text-xs text-muted">Waiting for the AI&apos;s first pass…</p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`rounded px-2 py-1.5 ${
            m.role === "assistant"
              ? "bg-surface border border-border-soft"
              : "bg-brand-50 text-brand-900 ml-6"
          }`}
        >
          {m.role === "assistant" && (
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase text-muted">
              <Sparkles size={10} /> AI
            </p>
          )}
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {proposals.map((p) => (
        <div key={p.domain} className="rounded border border-brand-500 bg-brand-50 px-3 py-2">
          <p className="text-xs">
            <strong>Add {getImportSchema(p.domain).displayName} tab?</strong> {p.reason}
          </p>
          <div className="mt-2">
            <Button size="sm" disabled={busy} onClick={() => onAcceptProposal(p.domain)}>
              Yes, add it
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabBar({
  active,
  setActive,
  targets,
  counts,
}: {
  active: ImportDomain;
  setActive: (d: ImportDomain) => void;
  targets: ImportDomain[];
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1 border-b border-border-soft text-xs">
      {targets.map((d) => {
        const isActive = d === active;
        return (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={`px-3 py-1.5 -mb-px border-b-2 ${
              isActive
                ? "border-brand-500 text-brand-700 font-medium"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {getImportSchema(d).displayName}
            <span className="ml-1 text-[10px] text-muted">({counts[d] ?? 0})</span>
          </button>
        );
      })}
    </div>
  );
}

function CostBar({ pct, spent }: { pct: number; spent: number }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
      <span>${spent.toFixed(3)} / ${IMPORT_CHAT_COST_CAP_USD.toFixed(2)}</span>
      <div className="flex-1 h-1 rounded bg-border-soft overflow-hidden">
        <div
          className={`h-full ${pct > 80 ? "bg-danger-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Done step
// ─────────────────────────────────────────────────────────────────────

function DoneStep({
  result,
  onClose,
}: {
  result: Extract<CommitResult, { ok: true }>;
  onClose: () => void;
}) {
  const totals = Object.entries(result.insertedByDomain) as [ImportDomain, number][];
  return (
    <div className="py-4">
      <div className="mb-4 flex items-center gap-3">
        <CheckCircle2 size={32} className="text-brand-500" />
        <div>
          <p className="font-medium">Import complete.</p>
          <p className="text-xs text-muted">Audit log records every inserted row.</p>
        </div>
      </div>
      <ul className="mb-4 space-y-1 text-sm">
        {totals.map(([d, n]) => (
          <li key={d}>
            <strong>{getImportSchema(d).displayName}:</strong> {n} row{n === 1 ? "" : "s"}
          </li>
        ))}
        {result.newLookupsCreated.length > 0 && (
          <li className="text-xs text-muted">
            + {result.newLookupsCreated.length} new lookup row
            {result.newLookupsCreated.length === 1 ? "" : "s"} created
          </li>
        )}
      </ul>
      <div className="flex justify-end">
        <Button onClick={onClose}>
          <X size={16} /> Close
        </Button>
      </div>
    </div>
  );
}
