"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function SetPasswordButton({
  userId,
  userLabel,
  disabled,
}: {
  userId: string;
  userLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const { push } = useToast();

  const reset = () => {
    setError(undefined);
    setFieldErrors({});
  };

  const submit = (formData: FormData) => {
    reset();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 8) {
      setFieldErrors({ password: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: "Passwords don't match." });
      return;
    }

    start(async () => {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/set-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to set password.");
        return;
      }
      push({ tone: "success", message: "Password updated." });
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={disabled}
      >
        <KeyRound size={16} /> Set password
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Set password — ${userLabel}`}
      >
        <form action={submit} className="space-y-3">
          <p className="text-xs text-muted">
            Sets a new password for this user immediately. Share it with them
            over a secure channel and ask them to change it on first sign-in.
          </p>
          <div>
            <Label htmlFor="password" required>
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
            />
            <FieldError message={fieldErrors.password} />
          </div>
          <div>
            <Label htmlFor="confirm" required>
              Confirm password
            </Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
            />
            <FieldError message={fieldErrors.confirm} />
          </div>
          {error && (
            <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Set password"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
