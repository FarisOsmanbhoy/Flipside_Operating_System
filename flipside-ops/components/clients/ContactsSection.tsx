"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  Input,
  Label,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  saveContact,
  deleteContact,
  type ContactState,
} from "@/app/(app)/(operational)/clients/actions";
import type { ClientContact } from "@/lib/database.types";

export function ContactsSection({
  clientId,
  contacts,
  canEdit,
}: {
  clientId: string;
  contacts: ClientContact[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ClientContact | null>(null);
  const [open, setOpen] = useState(false);
  const { push } = useToast();
  const [pendingDelete, startDelete] = useTransition();

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: ClientContact) => {
    setEditing(c);
    setOpen(true);
  };
  const remove = (c: ClientContact) =>
    startDelete(async () => {
      if (!confirm(`Delete ${c.name}?`)) return;
      try {
        await deleteContact(c.id, clientId);
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Delete failed",
        });
      }
    });

  return (
    <>
      <div className="space-y-2">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted italic">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-ink">{c.name}</div>
                  {c.role && (
                    <div className="text-xs text-muted">{c.role}</div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-brand-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Mail size={12} /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-brand-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Phone size={12} /> {c.phone}
                      </a>
                    )}
                    {c.preferred_channel && (
                      <span className="text-muted">
                        Prefers: {c.preferred_channel}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <p className="text-xs text-muted mt-1">{c.notes}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 text-muted hover:text-brand-700"
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(c)}
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
        )}
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openNew}
            className="mt-2"
          >
            <Plus size={14} /> Add contact
          </Button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit contact" : "Add contact"}
      >
        <ContactForm
          clientId={clientId}
          contact={editing}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function ContactForm({
  clientId,
  contact,
  onDone,
}: {
  clientId: string;
  contact: ClientContact | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(
    async (prev, fd) => {
      const result = await saveContact(prev, fd);
      if (!result?.error && !result?.fieldErrors) onDone();
      return result;
    },
    undefined,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      {contact && <input type="hidden" name="id" value={contact.id} />}

      <div>
        <Label htmlFor="name" required>
          Name
        </Label>
        <Input id="name" name="name" defaultValue={contact?.name ?? ""} required />
        <FieldError message={state?.fieldErrors?.name?.[0]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="role">Role</Label>
          <Input id="role" name="role" defaultValue={contact?.role ?? ""} />
        </div>
        <div>
          <Label htmlFor="preferred_channel">Preferred channel</Label>
          <Input
            id="preferred_channel"
            name="preferred_channel"
            defaultValue={contact?.preferred_channel ?? ""}
            placeholder="Email / Phone / Text"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
          />
          <FieldError message={state?.fieldErrors?.email?.[0]} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={contact?.phone ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={contact?.notes ?? ""} />
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
