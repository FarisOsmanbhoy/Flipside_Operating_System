"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import {
  ContextPanel,
  EmptyContextPanel,
} from "@/components/layout/ContextPanel";
import { useToast } from "@/components/ui/Toast";
import {
  setUserLevel,
  setUserActive,
} from "@/app/(app)/(administration)/admin/users/actions";
import { LEVEL_LABELS, type AccessLevel } from "@/lib/access";
import type { Profile } from "@/lib/database.types";

type Dept = { id: string; name: string };

const levelTone = (l: number) =>
  l >= 3 ? "brand" : l >= 2 ? "accent" : "neutral";

export function UserContextPanel({
  user,
  departments,
}: {
  user: Profile | null;
  departments: Dept[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = useTransition();
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  if (!user) {
    return (
      <EmptyContextPanel description="Select a user to edit access level or status." />
    );
  }

  const updateLevel = (access_level: AccessLevel) =>
    start(async () => {
      try {
        await setUserLevel({ id: user.id, access_level });
        push({ tone: "success", message: "Access level updated." });
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
        push({
          tone: "success",
          message: user.is_active ? "Deactivated." : "Reactivated.",
        });
        router.refresh();
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  return (
    <ContextPanel>
      <ContextPanel.Header>
        <Avatar name={user.full_name} src={user.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">
            {user.full_name ?? user.email}
          </div>
          <div className="text-xs text-muted truncate">{user.email}</div>
          <div className="mt-1 flex gap-1">
            <Pill tone={levelTone(user.access_level)} dot>
              L{user.access_level} · {LEVEL_LABELS[user.access_level]}
            </Pill>
            {user.is_active ? (
              <Pill tone="success" dot>
                Active
              </Pill>
            ) : (
              <Pill tone="danger" dot>
                Inactive
              </Pill>
            )}
          </div>
        </div>
      </ContextPanel.Header>
      <ContextPanel.Body>
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1">
            Access level
          </span>
          <Select
            value={String(user.access_level)}
            disabled={pending}
            onChange={(e) =>
              updateLevel(Number(e.target.value) as AccessLevel)
            }
          >
            <option value="1">Level 1 — Editor</option>
            <option value="2">Level 2 — Manager</option>
            <option value="3">Level 3 — Admin (full access)</option>
          </Select>
          <span className="block text-xs text-muted mt-1">
            L3 configures everything · L2 amends client data · L1 adds own tasks
          </span>
        </label>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">
            Department
          </div>
          <div className="text-sm">
            {user.department_id
              ? (deptMap.get(user.department_id) ?? "—")
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">
            Phone
          </div>
          <div className="text-sm">{user.phone ?? user.mobile ?? "—"}</div>
        </div>
      </ContextPanel.Body>
      <ContextPanel.Footer>
        <Button
          variant={user.is_active ? "outline" : "primary"}
          onClick={toggleActive}
          disabled={pending}
        >
          {user.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </ContextPanel.Footer>
    </ContextPanel>
  );
}
