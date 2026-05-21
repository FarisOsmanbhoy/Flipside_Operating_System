"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { upsertSupplierSectionData } from "@/app/(app)/(operational)/suppliers/actions";
import { useToast } from "@/components/ui/Toast";

type Props = {
  supplierId: string;
  sectionTypeId: string;
  body: string;
  canEdit: boolean;
};

export function SupplierSectionBodyEditor({
  supplierId,
  sectionTypeId,
  body,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [pending, start] = useTransition();
  const { push } = useToast();

  const save = () =>
    start(async () => {
      try {
        await upsertSupplierSectionData({
          supplier_id: supplierId,
          section_type_id: sectionTypeId,
          data: { body: draft },
        });
        setEditing(false);
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Save failed",
        });
      }
    });

  if (editing) {
    return (
      <div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-32 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
    );
  }

  return (
    <div className="group">
      {body ? (
        <p className="text-sm text-ink whitespace-pre-wrap">{body}</p>
      ) : (
        <p className="text-sm text-muted italic">No notes yet.</p>
      )}
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-brand-700 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil size={12} className="inline" /> Edit
        </button>
      )}
    </div>
  );
}
