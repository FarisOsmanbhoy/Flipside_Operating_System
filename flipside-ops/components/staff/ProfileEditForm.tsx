"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { updateProfile, type ProfileState } from "@/app/(app)/(company)/staff/actions";
import type { Profile, Department } from "@/lib/database.types";

export function ProfileEditForm({
  profile,
  departments,
  isAdmin,
  isSelf,
}: {
  profile: Profile;
  departments: Pick<Department, "id" | "name">[];
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <input type="hidden" name="id" value={profile.id} />

      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name ?? ""}
        />
        <FieldError message={state?.fieldErrors?.full_name?.[0]} />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
      </div>

      <div>
        <Label htmlFor="mobile">Mobile</Label>
        <Input id="mobile" name="mobile" defaultValue={profile.mobile ?? ""} />
      </div>

      <div>
        <Label htmlFor="start_date">Start date</Label>
        <Input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={profile.start_date ?? ""}
          disabled={!isAdmin}
        />
      </div>

      <div>
        <Label htmlFor="department_id">Department</Label>
        <Select
          id="department_id"
          name="department_id"
          defaultValue={profile.department_id ?? ""}
          disabled={!isAdmin}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      {isAdmin && !isSelf && (
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" defaultValue={profile.role}>
            <option value="editor">editor</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </Select>
        </div>
      )}

      <div className="sm:col-span-2 flex items-center justify-between">
        {state?.error && (
          <p className="text-sm text-danger-700">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-emerald-700">Saved.</p>
        )}
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
