"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import {
  updateProfile,
  type ProfileState,
} from "@/app/(app)/(company)/staff/actions";
import type { Profile, Department } from "@/lib/database.types";
import { formatLanguageList } from "@/lib/format";

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

  // Permission matrix per the spec.
  const canEditName = isSelf || isAdmin;
  const canEditMobile = isSelf || isAdmin;
  const adminOnly = isAdmin; // every other editable field

  return (
    <form
      action={action}
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <input type="hidden" name="id" value={profile.id} />

      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name ?? ""}
          disabled={!canEditName}
        />
        <FieldError message={state?.fieldErrors?.full_name?.[0]} />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={profile.email}
          disabled={!adminOnly}
        />
        <FieldError message={state?.fieldErrors?.email?.[0]} />
      </div>

      <div>
        <Label htmlFor="mobile">Mobile</Label>
        <Input
          id="mobile"
          name="mobile"
          defaultValue={profile.mobile ?? ""}
          disabled={!canEditMobile}
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={profile.phone ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div>
        <Label htmlFor="extension">Extension</Label>
        <Input
          id="extension"
          name="extension"
          defaultValue={profile.extension ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div>
        <Label htmlFor="date_of_birth">Date of birth</Label>
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          defaultValue={profile.date_of_birth ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div>
        <Label htmlFor="department_id">Department</Label>
        <Select
          id="department_id"
          name="department_id"
          defaultValue={profile.department_id ?? ""}
          disabled={!adminOnly}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="job_title">Job title</Label>
        <Input
          id="job_title"
          name="job_title"
          defaultValue={profile.job_title ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div>
        <Label htmlFor="start_date">Start date</Label>
        <Input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={profile.start_date ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div>
        <Label htmlFor="car_registration">Car registration</Label>
        <Input
          id="car_registration"
          name="car_registration"
          defaultValue={profile.car_registration ?? ""}
          disabled={!adminOnly}
        />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="languages">Languages</Label>
        <Input
          id="languages"
          name="languages"
          placeholder="English, Spanish, …"
          defaultValue={formatLanguageList(profile.languages)}
          disabled={!adminOnly}
        />
        <p className="mt-1 text-xs text-muted">
          Comma-separated list.
        </p>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="specialisation">Specialisation</Label>
        <Input
          id="specialisation"
          name="specialisation"
          defaultValue={profile.specialisation ?? ""}
          disabled={!adminOnly}
        />
      </div>

      {isAdmin && !isSelf && (
        <div>
          <Label htmlFor="access_level">Access level</Label>
          <Select
            id="access_level"
            name="access_level"
            defaultValue={String(profile.access_level)}
          >
            <option value="1">Level 1 — Editor</option>
            <option value="2">Level 2 — Manager</option>
            <option value="3">Level 3 — Admin (full access)</option>
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
