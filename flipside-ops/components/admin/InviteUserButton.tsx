"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function InviteUserButton({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const submit = async (formData: FormData) => {
    start(async () => {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          full_name: formData.get("full_name"),
          access_level: Number(formData.get("access_level")),
          department_id: formData.get("department_id") || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({ tone: "error", message: json.error ?? "Invite failed." });
        return;
      }
      push({ tone: "success", message: "Invite sent." });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Invite user
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a user">
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
              <Select id="department_id" name="department_id" defaultValue="">
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
