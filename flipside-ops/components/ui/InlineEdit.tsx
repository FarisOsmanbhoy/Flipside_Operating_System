"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "./Input";
import { useToast } from "./Toast";
import { cn } from "@/lib/format";

type Props = {
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  /** Server action that takes the new value and persists it. Throws on error. */
  onSave: (next: string) => Promise<void>;
  /** Render the read-only display. Defaults to plain text. */
  renderDisplay?: (v: string | null) => React.ReactNode;
  canEdit?: boolean;
  className?: string;
};

export function InlineEdit({
  value,
  placeholder = "—",
  multiline = false,
  onSave,
  renderDisplay,
  canEdit = true,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();
  const { push } = useToast();

  if (!editing) {
    return (
      <div className={cn("group inline-flex items-start gap-2", className)}>
        <span className={cn(!value && "text-muted italic")}>
          {renderDisplay ? renderDisplay(value) : value || placeholder}
        </span>
        {canEdit && (
          <button
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-brand-700"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  }

  const commit = () => {
    start(async () => {
      try {
        await onSave(draft);
        setEditing(false);
      } catch (err) {
        push({
          tone: "error",
          message: err instanceof Error ? err.message : "Save failed",
        });
      }
    });
  };

  return (
    <div className={cn("flex items-start gap-2", className)}>
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-24 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      ) : (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !multiline) commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
      <button
        onClick={commit}
        disabled={pending}
        className="p-1.5 rounded bg-brand-500 text-white hover:bg-brand-700 disabled:opacity-60"
        aria-label="Save"
      >
        <Check size={14} />
      </button>
      <button
        onClick={() => setEditing(false)}
        disabled={pending}
        className="p-1.5 rounded bg-canvas text-muted hover:bg-gray-200"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
