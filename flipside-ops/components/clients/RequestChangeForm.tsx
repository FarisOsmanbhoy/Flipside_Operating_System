"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import {
  submitChangeRequest,
  type ChangeRequestState,
} from "@/app/(app)/(operational)/clients/change-requests/actions";

export function RequestChangeForm({
  clientId,
  sectionTypes,
}: {
  clientId: string;
  sectionTypes: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ChangeRequestState, FormData>(
    submitChangeRequest,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />

      <div>
        <Label htmlFor="section_type_id">Section</Label>
        <Select id="section_type_id" name="section_type_id" defaultValue="">
          <option value="">— Choose a section —</option>
          {sectionTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="summary" required>
          What should change &amp; why?
        </Label>
        <Textarea
          id="summary"
          name="summary"
          required
          rows={6}
          placeholder="Describe the change you want. Include enough context that a PM can act without coming back to you."
        />
        <FieldError message={state?.fieldErrors?.summary?.[0]} />
      </div>

      {state?.error && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-500/30 rounded-lg px-3 py-2">
          Request submitted. A manager has been notified.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
