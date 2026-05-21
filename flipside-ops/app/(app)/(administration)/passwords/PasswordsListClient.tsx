"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Search, ExternalLink } from "lucide-react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Label } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { canManage } from "@/lib/access";
import type { SessionProfile } from "@/lib/access";
import {
  createPassword,
  updatePassword,
  deletePassword,
} from "./actions";

type Row = {
  id: string;
  category_id: string;
  system: string;
  dept_id: string | null;
  username: string | null;
  password: string | null;
  web_address: string | null;
  further_info: string | null;
};

type Category = { id: string; name: string; display_order: number };
type Department = { id: string; name: string };

type FormState = {
  category_id: string;
  system: string;
  dept_id: string;
  username: string;
  password: string;
  web_address: string;
  further_info: string;
};

const blankForm = (categoryId = ""): FormState => ({
  category_id: categoryId,
  system: "",
  dept_id: "",
  username: "",
  password: "",
  web_address: "",
  further_info: "",
});

const rowToForm = (r: Row): FormState => ({
  category_id: r.category_id,
  system: r.system,
  dept_id: r.dept_id ?? "",
  username: r.username ?? "",
  password: r.password ?? "",
  web_address: r.web_address ?? "",
  further_info: r.further_info ?? "",
});

export function PasswordsListClient({
  session,
  rows,
  categories,
  departments,
  initialQ,
}: {
  session: SessionProfile;
  rows: Row[];
  categories: Category[];
  departments: Department[];
  initialQ: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(blankForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canEdit = canManage(session);
  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          [r.system, r.username, r.web_address, r.further_info]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(needle)),
        )
      : rows;

    const byCat = new Map<string, Row[]>();
    for (const r of filtered) {
      const arr = byCat.get(r.category_id);
      if (arr) arr.push(r);
      else byCat.set(r.category_id, [r]);
    }
    return categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ category: c, rows: byCat.get(c.id)! }));
  }, [rows, categories, q]);

  const wrap = (fn: () => Promise<void>, successMsg?: string) =>
    start(async () => {
      try {
        await fn();
        if (successMsg) push({ tone: "success", message: successMsg });
        router.refresh();
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Failed",
        });
      }
    });

  const onAddSubmit = () => {
    if (!addForm.category_id || !addForm.system.trim()) {
      push({ tone: "error", message: "Category and system are required." });
      return;
    }
    wrap(async () => {
      await createPassword(addForm);
      setAddOpen(false);
      setAddForm(blankForm());
    }, "Password added");
  };

  const onEditSubmit = () => {
    if (!editingId || !editForm) return;
    if (!editForm.category_id || !editForm.system.trim()) {
      push({ tone: "error", message: "Category and system are required." });
      return;
    }
    wrap(async () => {
      await updatePassword(editingId, editForm);
      setEditingId(null);
      setEditForm(null);
    }, "Password updated");
  };

  const onDelete = (id: string) => {
    wrap(async () => {
      await deletePassword(id);
      setConfirmDeleteId(null);
    }, "Password deleted");
  };

  const filters = (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
          Search
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="System, username…"
            className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setAddForm(blankForm(categories[0]?.id ?? ""));
            setAddOpen(true);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} />
          Add New Password
        </button>
      )}
    </div>
  );

  const colCount = canEdit ? 7 : 6;

  return (
    <ThreePaneLayout filters={filters}>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="fs-data-table">
            <thead>
              <tr>
                <th>System</th>
                <th>Department</th>
                <th>Username</th>
                <th>Password</th>
                <th>Web address</th>
                <th>Further info</th>
                {canEdit && <th className="text-right">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-12">
                    <span className="text-sm text-muted">
                      {q ? "No matches." : "No passwords yet."}
                    </span>
                  </td>
                </tr>
              ) : (
                grouped.flatMap(({ category, rows: groupRows }) => [
                  <tr
                    key={`g-${category.id}`}
                    className="bg-canvas/60"
                  >
                    <td colSpan={colCount} className="py-2">
                      <span className="text-sm font-semibold text-brand-700">
                        {category.name}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        ({groupRows.length})
                      </span>
                    </td>
                  </tr>,
                  ...groupRows.flatMap((r) => {
                    const isEditing = editingId === r.id;
                    return [
                      <tr key={r.id}>
                        <td className="font-medium">{r.system}</td>
                        <td className="text-muted">
                          {r.dept_id ? deptMap.get(r.dept_id) ?? "—" : "—"}
                        </td>
                        <td className="text-muted">{r.username || "—"}</td>
                        <td className="font-mono text-sm">
                          {r.password || "—"}
                        </td>
                        <td>
                          {r.web_address ? (
                            <a
                              href={r.web_address}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-brand-700 hover:underline inline-flex items-center gap-1 max-w-[16rem] truncate"
                            >
                              <ExternalLink
                                size={12}
                                className="shrink-0"
                              />
                              <span className="truncate">{r.web_address}</span>
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-muted text-sm max-w-[14rem]">
                          {r.further_info || "—"}
                        </td>
                        {canEdit && (
                          <td className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingId(null);
                                    setEditForm(null);
                                  } else {
                                    setEditingId(r.id);
                                    setEditForm(rowToForm(r));
                                  }
                                }}
                                aria-label={isEditing ? "Cancel edit" : "Edit"}
                                className="p-1.5 rounded bg-amber-400 text-white hover:bg-amber-500"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(r.id)}
                                aria-label="Delete"
                                className="p-1.5 rounded bg-danger-500 text-white hover:bg-danger-700"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>,
                      isEditing && editForm ? (
                        <tr key={`${r.id}-edit`} className="bg-brand-50/40">
                          <td colSpan={colCount} className="p-4">
                            <PasswordForm
                              form={editForm}
                              onChange={setEditForm as (f: FormState) => void}
                              categories={categories}
                              departments={departments}
                            />
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditForm(null);
                                }}
                                disabled={pending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={onEditSubmit}
                                disabled={pending}
                              >
                                Save
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  }),
                ])
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add new password"
      >
        <PasswordForm
          form={addForm}
          onChange={setAddForm}
          categories={categories}
          departments={departments}
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setAddOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={onAddSubmit} disabled={pending}>
            Add password
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete password?"
      >
        <p className="text-sm text-ink">
          This will remove the entry permanently. The action is logged in the
          audit log.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDeleteId(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => confirmDeleteId && onDelete(confirmDeleteId)}
            disabled={pending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </ThreePaneLayout>
  );
}

function PasswordForm({
  form,
  onChange,
  categories,
  departments,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  categories: Category[];
  departments: Department[];
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label required>Category</Label>
        <Select
          value={form.category_id}
          onChange={(e) => set("category_id", e.target.value)}
        >
          <option value="">Select…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label required>System</Label>
        <Input
          value={form.system}
          onChange={(e) => set("system", e.target.value)}
          placeholder="FlightAware"
        />
      </div>
      <div>
        <Label>Department</Label>
        <Select
          value={form.dept_id}
          onChange={(e) => set("dept_id", e.target.value)}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Username</Label>
        <Input
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
      </div>
      <div>
        <Label>Password</Label>
        <Input
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
      </div>
      <div>
        <Label>Web address</Label>
        <Input
          value={form.web_address}
          onChange={(e) => set("web_address", e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Further info</Label>
        <Textarea
          value={form.further_info}
          onChange={(e) => set("further_info", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
