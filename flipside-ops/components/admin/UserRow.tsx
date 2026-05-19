"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setUserRole, setUserActive } from "@/app/(app)/admin/users/actions";
import type { Profile } from "@/lib/database.types";

export function UserRow({
  user,
  display,
  statusPill,
}: {
  user: Profile;
  display: React.ReactNode;
  statusPill: React.ReactNode;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = useTransition();

  const updateRole = (role: "admin" | "manager" | "editor") =>
    start(async () => {
      try {
        await setUserRole({ id: user.id, role });
        push({ tone: "success", message: "Role updated." });
        router.refresh();
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  const toggleActive = () =>
    start(async () => {
      try {
        await setUserActive({ id: user.id, is_active: !user.is_active });
        push({ tone: "success", message: "Updated." });
        router.refresh();
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  return (
    <tr className={user.is_active ? "" : "opacity-60"}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">{display}</div>
      </td>
      <td className="px-5 py-3 text-muted">{user.email}</td>
      <td className="px-5 py-3">
        <Select
          value={user.role}
          onChange={(e) =>
            updateRole(e.target.value as "admin" | "manager" | "editor")
          }
          disabled={pending}
          className="h-8 text-xs w-32"
        >
          <option value="editor">editor</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </Select>
      </td>
      <td className="px-5 py-3">{statusPill}</td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={toggleActive}
          disabled={pending}
          className="text-xs text-brand-700 hover:underline disabled:opacity-50"
        >
          {user.is_active ? "Deactivate" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}
