"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Success = {
  user_id: string;
  action_link: string;
  email_sent: boolean;
  email_reason?: string;
};

export function InviteUserButton({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [success, setSuccess] = useState<Success | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  const reset = () => {
    setSuccess(null);
    setError(undefined);
    setFieldErrors({});
    setCopied(false);
  };

  const close = () => {
    setOpen(false);
    if (success) router.refresh();
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
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password,
          full_name: formData.get("full_name"),
          access_level: Number(formData.get("access_level")),
          department_id: formData.get("department_id") || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Invite failed.");
        return;
      }
      push({ tone: "success", message: "Account created." });
      setSuccess({
        user_id: json.user_id,
        action_link: json.action_link,
        email_sent: json.email_sent,
        email_reason: json.email_reason,
      });
    });
  };

  const copyLink = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.action_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push({ tone: "error", message: "Could not copy to clipboard." });
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <UserPlus size={16} /> Invite user
      </Button>
      <Modal open={open} onClose={close} title="Invite a user">
        {success ? (
          <div className="space-y-4">
            <p className="text-sm">
              Account created. The user can sign in either with the one-time
              link below or with the password you set.
            </p>
            <div>
              <Label>One-time sign-in link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={success.action_link}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <div
              className={
                success.email_sent
                  ? "text-sm text-emerald-700 bg-emerald-50 border border-emerald-500/30 rounded-lg px-3 py-2"
                  : "text-sm text-amber-700 bg-amber-50 border border-amber-500/30 rounded-lg px-3 py-2"
              }
            >
              {success.email_sent
                ? "Invite email sent. They'll also receive the link by email."
                : `Email not sent (${
                    success.email_reason ?? "unknown reason"
                  }). Share the link manually.`}
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form action={submit} className="space-y-3">
            <div>
              <Label htmlFor="full_name" required>
                Full name
              </Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div>
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="password" required>
                  Initial password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                  minLength={8}
                  autoComplete="new-password"
                />
                <FieldError message={fieldErrors.confirm} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="access_level" required>
                  Access level
                </Label>
                <Select id="access_level" name="access_level" defaultValue="1">
                  <option value="1">Level 1 — Editor</option>
                  <option value="2">Level 2 — Manager</option>
                  <option value="3">Level 3 — Admin</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="department_id">Department</Label>
                <Select
                  id="department_id"
                  name="department_id"
                  defaultValue=""
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {error && (
              <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
