"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { updatePassword, type ResetState } from "./actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    updatePassword,
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password" required>
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <FieldError message={state?.fieldErrors?.password?.[0]} />
      </div>
      <div>
        <Label htmlFor="confirm" required>
          Confirm
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <FieldError message={state?.fieldErrors?.confirm?.[0]} />
      </div>
      {state?.error && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
