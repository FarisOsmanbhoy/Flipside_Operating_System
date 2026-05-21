"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateAssignedPm } from "@/app/(app)/(operational)/clients/actions";

type Pm = { id: string; full_name: string | null; avatar_url?: string | null };

export function AssignedPMPicker({
  clientId,
  currentPm,
  candidates,
  canEdit,
}: {
  clientId: string;
  currentPm: Pm | null;
  candidates: Pm[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(currentPm?.id ?? "");
  const [pending, start] = useTransition();
  const { push } = useToast();

  const save = () =>
    start(async () => {
      try {
        await updateAssignedPm({
          client_id: clientId,
          assigned_pm_id: draft || null,
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
      <div className="flex items-center gap-2 text-sm">
        <UserIcon size={14} className="text-muted" />
        <span className="text-muted">Assigned PM:</span>
        <Select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 py-1 text-sm"
          autoFocus
        >
          <option value="">— Unassigned —</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? "(no name)"}
            </option>
          ))}
        </Select>
        <button
          onClick={save}
          disabled={pending}
          className="p-1 rounded text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          aria-label="Save"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => {
            setDraft(currentPm?.id ?? "");
            setEditing(false);
          }}
          disabled={pending}
          className="p-1 rounded text-muted hover:bg-canvas disabled:opacity-50"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <UserIcon size={14} className="text-muted" />
      {currentPm?.full_name ? (
        <>
          <Avatar
            name={currentPm.full_name}
            src={currentPm.avatar_url ?? null}
            size={20}
          />
          <span>
            Assigned PM: <strong>{currentPm.full_name}</strong>
          </span>
        </>
      ) : (
        <span className="text-muted italic">No PM assigned</span>
      )}
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded text-muted hover:text-brand-700 hover:bg-canvas"
          aria-label="Change assigned PM"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}
