"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideChangeRequest } from "@/app/(app)/(operational)/clients/change-requests/actions";
import { useToast } from "@/components/ui/Toast";

export function ChangeRequestActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const { push } = useToast();

  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      try {
        await decideChangeRequest({ id, decision, decision_notes: notes });
        push({ tone: "success", message: `Marked ${decision}.` });
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  return (
    <div className="flex flex-col gap-2 shrink-0 w-56">
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Decision notes (optional)"
          className="w-full text-xs min-h-16 rounded border border-border-soft px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <Check size={14} /> Approve
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-sm rounded bg-danger-500 text-white hover:bg-danger-700 disabled:opacity-60"
        >
          <X size={14} /> Reject
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowNotes((v) => !v)}
        className="text-xs text-muted hover:text-brand-700"
      >
        {showNotes ? "Hide notes" : "Add notes"}
      </button>
    </div>
  );
}
