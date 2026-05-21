"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  changeMyPassword,
  type ChangeMyPasswordState,
} from "@/app/(app)/(company)/staff/actions";

export function ChangeMyPasswordCard() {
  const [state, action, pending] = useActionState<
    ChangeMyPasswordState,
    FormData
  >(changeMyPassword, undefined);
  const { push } = useToast();

  useEffect(() => {
    if (state?.success) {
      push({ tone: "success", message: "Password updated." });
    }
  }, [state?.success, push]);

  return (
    <form action={action} className="space-y-4 max-w-md">
      <p className="text-xs text-muted">
        Set or change your own password. You stay signed in.
      </p>
      <div>
        <Label htmlFor="my-password" required>
          New password
        </Label>
        <Input
          id="my-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <FieldError message={state?.fieldErrors?.password?.[0]} />
      </div>
      <div>
        <Label htmlFor="my-confirm" required>
          Confirm
        </Label>
        <Input
          id="my-confirm"
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
