"use client";

import { AlertTriangle, Pencil, Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateClientField } from "@/app/(app)/(operational)/clients/actions";
import { useToast } from "@/components/ui/Toast";

export function ImportantInfoBox({
  clientId,
  value,
  canEdit,
}: {
  clientId: string;
  value: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();
  const { push } = useToast();

  const save = () =>
    start(async () => {
      try {
        await updateClientField({
          id: clientId,
          field: "important_info",
          value: draft || null,
        });
        setEditing(false);
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Save failed",
        });
      }
    });

  return (
    <div className="bg-warning-50 border border-warning-500/40 rounded-[var(--radius-card)] p-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-warning-700 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-warning-700">
            Important info &amp; quirks
          </h3>
          {canEdit && !editing && (
            <button
              onClick={() => {
                setDraft(value ?? "");
                setEditing(true);
              }}
              className="text-warning-700 hover:opacity-70"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-h-24 rounded-lg border border-warning-500/40 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-warning-500"
              placeholder="Things staff need to know that aren't written anywhere else."
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setEditing(false)}
                disabled={pending}
                className="px-3 py-1 text-sm rounded bg-canvas text-ink hover:bg-gray-200"
              >
                <X size={14} className="inline" /> Cancel
              </button>
              <button
                onClick={save}
                disabled={pending}
                className="px-3 py-1 text-sm rounded bg-brand-500 text-white hover:bg-brand-700"
              >
                <Check size={14} className="inline" />{" "}
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : value ? (
          <p className="text-sm text-ink whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-muted italic">
            No notes yet — the spot for unwritten rules, quirks, who the real
            decision-maker is.
          </p>
        )}
      </div>
    </div>
  );
}
