"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import {
  applyFieldSuggestion,
  suggestField,
} from "@/app/(app)/(administration)/admin/diagnostics/actions";

type Suggestion = {
  id: string;
  label: string;
  reason: string;
  confidence: number;
};

// Small inline "Suggest with AI" button for empty lookup columns. Visible
// only when rendered (caller decides — typically: admin user AND field empty).
//
// Flow: click -> AI suggests -> admin accepts (writes through) or rejects.
export function SuggestFieldButton({
  domain,
  entityId,
  dbColumn,
  fieldLabel,
}: {
  domain: "clients" | "suppliers" | "passwords";
  entityId: string;
  dbColumn: string;
  fieldLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ask = () => {
    setError(null);
    setSuggestion(null);
    startTransition(async () => {
      const res = await suggestField({ domain, entityId, dbColumn });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.suggestionId || !res.suggestionLabel) {
        setError(res.reason || "No confident suggestion.");
        return;
      }
      setSuggestion({
        id: res.suggestionId,
        label: res.suggestionLabel,
        reason: res.reason,
        confidence: res.confidence,
      });
    });
  };

  const accept = () => {
    if (!suggestion) return;
    setError(null);
    startTransition(async () => {
      const res = await applyFieldSuggestion({
        domain,
        entityId,
        dbColumn,
        valueId: suggestion.id,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-brand-700">
        <Check size={12} /> Applied. Refresh to see.
      </span>
    );
  }

  if (!suggestion) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={ask}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded border border-border-soft bg-surface px-2 py-1 text-xs hover:bg-canvas disabled:opacity-50"
          title={`Ask AI to suggest a ${fieldLabel}`}
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          Suggest {fieldLabel}
        </button>
        {error && <span className="text-xs text-danger-700">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded border border-border-soft bg-canvas px-2 py-1 text-xs">
      <Sparkles size={12} className="text-brand-500" />
      <span>
        <strong>{suggestion.label}</strong>{" "}
        <span className="text-muted">
          ({Math.round(suggestion.confidence * 100)}% — {suggestion.reason})
        </span>
      </span>
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded bg-brand-500 px-1.5 py-0.5 text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
        Accept
      </button>
      <button
        type="button"
        onClick={() => setSuggestion(null)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-border-soft px-1.5 py-0.5 text-muted hover:bg-surface"
      >
        <X size={10} /> Reject
      </button>
      {error && <span className="text-danger-700">{error}</span>}
    </span>
  );
}
