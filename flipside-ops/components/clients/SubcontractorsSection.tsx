"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  saveSubcontractor,
  deleteSubcontractor,
  type SubState,
} from "@/app/(app)/(operational)/clients/actions";
import type { ClientSubcontractor } from "@/lib/database.types";

export function SubcontractorsSection({
  clientId,
  subs,
  canEdit,
}: {
  clientId: string;
  subs: ClientSubcontractor[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ClientSubcontractor | null>(null);
  const [open, setOpen] = useState(false);
  const { push } = useToast();
  const [pendingDelete, startDelete] = useTransition();

  const grouped = subs.reduce(
    (acc, s) => {
      (acc[s.trade] ??= []).push(s);
      return acc;
    },
    {} as Record<string, ClientSubcontractor[]>,
  );

  const remove = (s: ClientSubcontractor) =>
    startDelete(async () => {
      if (!confirm(`Remove ${s.company_name}?`)) return;
      try {
        await deleteSubcontractor(s.id, clientId);
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Delete failed",
        });
      }
    });

  return (
    <>
      <div className="space-y-4">
        {subs.length === 0 ? (
          <p className="text-sm text-muted italic">No subs listed yet.</p>
        ) : (
          Object.entries(grouped).map(([trade, items]) => (
            <div key={trade}>
              <h4 className="text-xs font-semibold uppercase text-muted tracking-wide mb-1">
                {trade}
              </h4>
              <ul className="divide-y divide-border-soft">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="py-2 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.company_name}</span>
                        <Pill
                          tone={
                            s.status === "preferred"
                              ? "success"
                              : s.status === "backup"
                                ? "neutral"
                                : "danger"
                          }
                        >
                          {s.status}
                        </Pill>
                      </div>
                      {s.contact && (
                        <div className="text-xs text-muted">{s.contact}</div>
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted mt-1">{s.notes}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setOpen(true);
                          }}
                          className="p-1.5 text-muted hover:text-brand-700"
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          disabled={pendingDelete}
                          className="p-1.5 text-muted hover:text-danger-700"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={14} /> Add subcontractor
          </Button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit subcontractor" : "Add subcontractor"}
      >
        <SubForm
          clientId={clientId}
          sub={editing}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function SubForm({
  clientId,
  sub,
  onDone,
}: {
  clientId: string;
  sub: ClientSubcontractor | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<SubState, FormData>(
    async (prev, fd) => {
      const r = await saveSubcontractor(prev, fd);
      if (!r?.error && !r?.fieldErrors) onDone();
      return r;
    },
    undefined,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      {sub && <input type="hidden" name="id" value={sub.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="trade" required>
            Trade
          </Label>
          <Input
            id="trade"
            name="trade"
            defaultValue={sub?.trade ?? ""}
            placeholder="Drywall, electrical, etc."
            required
          />
          <FieldError message={state?.fieldErrors?.trade?.[0]} />
        </div>
        <div>
          <Label htmlFor="company_name" required>
            Company name
          </Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={sub?.company_name ?? ""}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="status" required>
          Status
        </Label>
        <Select
          id="status"
          name="status"
          defaultValue={sub?.status ?? "preferred"}
        >
          <option value="preferred">Preferred</option>
          <option value="backup">Backup</option>
          <option value="blacklisted">Blacklisted</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="contact">Contact</Label>
        <Input
          id="contact"
          name="contact"
          defaultValue={sub?.contact ?? ""}
          placeholder="Name + phone or email"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={sub?.notes ?? ""} />
      </div>
      {state?.error && (
        <div className="text-sm text-danger-700">{state.error}</div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
