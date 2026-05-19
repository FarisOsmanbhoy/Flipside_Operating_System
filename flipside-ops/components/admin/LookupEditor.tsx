"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  addLookup,
  updateLookup,
  deleteLookup,
} from "@/app/(app)/(administration)/admin/config/actions";

export function LookupEditor({
  table,
  items,
}: {
  table: string;
  items: { id: string; name: string; display_order: number; is_active: boolean }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");

  const wrap = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted italic">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 group"
            >
              <Input
                defaultValue={item.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== item.name) {
                    wrap(() =>
                      updateLookup({ table, id: item.id, name: v }),
                    );
                  }
                }}
                className="flex-1"
              />
              <label className="text-xs text-muted inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  defaultChecked={item.is_active}
                  onChange={(e) =>
                    wrap(() =>
                      updateLookup({
                        table,
                        id: item.id,
                        is_active: e.target.checked,
                      }),
                    )
                  }
                />
                Active
              </label>
              <button
                onClick={() => {
                  if (!confirm(`Delete "${item.name}"?`)) return;
                  wrap(() => deleteLookup({ table, id: item.id }));
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger-700"
                disabled={pending}
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border-soft">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new…"
          className="flex-1"
        />
        <Button
          size="sm"
          disabled={pending || !newName.trim()}
          onClick={() => {
            const v = newName.trim();
            if (!v) return;
            wrap(async () => {
              await addLookup({ table, name: v });
              setNewName("");
            });
          }}
        >
          <Plus size={14} /> Add
        </Button>
      </div>
    </div>
  );
}
