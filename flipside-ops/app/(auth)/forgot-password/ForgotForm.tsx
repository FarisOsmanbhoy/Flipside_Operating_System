"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { sendResetEmail, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    sendResetEmail,
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@flipsidespecialties.com"
        />
        <FieldError message={state?.fieldErrors?.email?.[0]} />
      </div>
      {state?.message && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-500/30 rounded-lg px-3 py-2">
          {state.message}
        </div>
      )}
      {state?.error && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/login"
        className="block text-center text-xs text-muted hover:text-brand-700"
      >
        Back to sign in
      </Link>
    </form>
  );
}
