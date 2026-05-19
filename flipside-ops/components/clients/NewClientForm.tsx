"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import {
  createClientRecord,
  type NewClientState,
} from "@/app/(app)/clients/actions";

type LookupItem = { id: string; name: string | null };

export function NewClientForm({
  statuses,
  types,
  pms,
}: {
  statuses: LookupItem[];
  types: LookupItem[];
  pms: { id: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<NewClientState, FormData>(
    createClientRecord,
    undefined,
  );

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label htmlFor="name" required>
          Client name
        </Label>
        <Input id="name" name="name" required autoFocus />
        <FieldError message={state?.fieldErrors?.name?.[0]} />
      </div>

      <div>
        <Label htmlFor="type_id">Type</Label>
        <Select id="type_id" name="type_id" defaultValue="">
          <option value="">—</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="status_id">Status</Label>
        <Select id="status_id" name="status_id" defaultValue="">
          <option value="">—</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" placeholder="City, region" />
      </div>

      <div>
        <Label htmlFor="since_date">Working together since</Label>
        <Input id="since_date" name="since_date" type="date" />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="assigned_pm_id">Assigned PM</Label>
        <Select id="assigned_pm_id" name="assigned_pm_id" defaultValue="">
          <option value="">—</option>
          {pms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="important_info">
          Important info &amp; quirks (shown in the amber callout)
        </Label>
        <Textarea
          id="important_info"
          name="important_info"
          placeholder="Unwritten rules, the real decision-maker, things to avoid…"
        />
      </div>

      {state?.error && (
        <div className="sm:col-span-2 text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <div className="sm:col-span-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
