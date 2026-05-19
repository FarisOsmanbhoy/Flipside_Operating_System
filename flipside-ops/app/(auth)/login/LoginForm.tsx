"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { signInWithPassword, sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const action = mode === "password" ? signInWithPassword : sendMagicLink;
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />

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
          autoComplete="email"
        />
        <FieldError message={state?.fieldErrors?.email?.[0]} />
      </div>

      {mode === "password" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-brand-700 hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <FieldError message={state?.fieldErrors?.password?.[0]} />
        </div>
      )}

      {state?.error && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Working…"
          : mode === "password"
            ? "Sign in"
            : "Send magic link"}
      </Button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "password" ? "magic" : "password"))}
        className="block w-full text-center text-xs text-muted hover:text-brand-700"
      >
        {mode === "password"
          ? "Sign in with a magic link instead"
          : "Use a password instead"}
      </button>
    </form>
  );
}
