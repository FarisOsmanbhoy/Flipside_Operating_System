"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  X,
  Search,
  Eye,
  FileText,
  Loader2,
} from "lucide-react";
import { ThreePaneLayout } from "@/components/layout/ThreePaneLayout";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { canManage } from "@/lib/access";
import type { SessionProfile } from "@/lib/access";
import { shortDate } from "@/lib/format";
import {
  createManual,
  updateManual,
  deleteManual,
  getManualSignedUrl,
} from "./actions";

type Row = {
  id: string;
  category_id: string;
  title: string;
  company: string | null;
  reference: string | null;
  revision_no: number | null;
  published_at: string | null;
  author_id: string | null;
  storage_path: string | null;
  file_name: string | null;
};

type Category = { id: string; name: string; display_order: number };
type Person = { id: string; full_name: string | null };

type EditFormState = {
  category_id: string;
  title: string;
  company: string;
  reference: string;
  revision_no: string;
};

const rowToEdit = (r: Row): EditFormState => ({
  category_id: r.category_id,
  title: r.title,
  company: r.company ?? "",
  reference: r.reference ?? "",
  revision_no: r.revision_no?.toString() ?? "",
});

export function ManualsListClient({
  session,
  rows,
  categories,
  people,
  initialQ,
}: {
  session: SessionProfile;
  rows: Row[];
  categories: Category[];
  people: Person[];
  initialQ: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  const canEdit = canManage(session);
  const peopleMap = useMemo(
    () => new Map(people.map((p) => [p.id, p.full_name ?? "—"])),
    [people],
  );

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          [r.title, r.company, r.reference, r.file_name]
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
    const form = addFormRef.current;
    if (!form) return;
    const fd = new FormData(form);
    if (!(fd.get("file") instanceof File) || (fd.get("file") as File).size === 0) {
      push({ tone: "error", message: "Please choose a file." });
      return;
    }
    if (!fd.get("category_id") || !(fd.get("title") as string)?.trim()) {
      push({ tone: "error", message: "Category and title are required." });
      return;
    }
    wrap(async () => {
      await createManual(fd);
      setAddOpen(false);
      form.reset();
    }, "Manual added");
  };

  const onEditSubmit = () => {
    if (!editingId || !editForm) return;
    if (!editForm.category_id || !editForm.title.trim()) {
      push({ tone: "error", message: "Category and title are required." });
      return;
    }
    wrap(async () => {
      await updateManual(editingId, {
        category_id: editForm.category_id,
        title: editForm.title,
        company: editForm.company,
        reference: editForm.reference,
        revision_no: editForm.revision_no === "" ? "" : Number(editForm.revision_no),
      });
      setEditingId(null);
      setEditForm(null);
    }, "Manual updated");
  };

  const onView = (id: string) => {
    setOpeningId(id);
    (async () => {
      try {
        const url = await getManualSignedUrl(id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        push({
          tone: "error",
          message: e instanceof Error ? e.message : "Could not open file",
        });
      } finally {
        setOpeningId(null);
      }
    })();
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
            placeholder="Title, company…"
            className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} />
          Add New File
        </button>
      )}
    </div>
  );

  const colCount = canEdit ? 8 : 7;

  return (
    <ThreePaneLayout filters={filters}>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="fs-data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Reference</th>
                <th>Revision no.</th>
                <th>Published</th>
                <th>User</th>
                <th className="text-center">View</th>
                {canEdit && <th className="text-right">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-12">
                    <span className="text-sm text-muted">
                      {q ? "No matches." : "No manuals yet."}
                    </span>
                  </td>
                </tr>
              ) : (
                grouped.flatMap(({ category, rows: groupRows }) => [
                  <tr key={`g-${category.id}`} className="bg-canvas/60">
                    <td colSpan={colCount} className="py-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                        <FileText size={14} />
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
                        <td className="font-medium max-w-[24rem]">
                          <span className="truncate block">{r.title}</span>
                          {r.file_name && (
                            <span className="text-xs text-muted truncate block">
                              {r.file_name}
                            </span>
                          )}
                        </td>
                        <td className="text-muted">{r.company || "—"}</td>
                        <td className="text-muted">{r.reference || "—"}</td>
                        <td className="text-muted">
                          {r.revision_no ?? "—"}
                        </td>
                        <td className="text-muted text-sm">
                          {r.published_at ? shortDate(r.published_at) : "—"}
                        </td>
                        <td className="text-muted text-sm">
                          {r.author_id
                            ? peopleMap.get(r.author_id) ?? "—"
                            : "—"}
                        </td>
                        <td className="text-center">
                          {r.storage_path ? (
                            <button
                              type="button"
                              onClick={() => onView(r.id)}
                              disabled={openingId === r.id}
                              className="inline-flex items-center gap-1 text-brand-700 hover:underline text-sm"
                            >
                              {openingId === r.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Eye size={12} />
                              )}
                              View
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
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
                                    setEditForm(rowToEdit(r));
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
                            <ManualEditForm
                              form={editForm}
                              onChange={setEditForm as (f: EditFormState) => void}
                              categories={categories}
                            />
                            <p className="mt-2 text-xs text-muted">
                              To replace the file, delete this entry and add a
                              new one.
                            </p>
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
        title="Add new file"
      >
        <form ref={addFormRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label required>Category</Label>
            <Select name="category_id" defaultValue="">
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label required>Title</Label>
            <Input name="title" placeholder="Accounts Emails Flow Chart" />
          </div>
          <div>
            <Label>Company</Label>
            <Input name="company" />
          </div>
          <div>
            <Label>Reference</Label>
            <Input name="reference" />
          </div>
          <div>
            <Label>Revision no.</Label>
            <Input name="revision_no" type="number" min={0} />
          </div>
          <div className="sm:col-span-2">
            <Label required>File</Label>
            <input
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
              className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="mt-1 text-xs text-muted">
              PDF, Word, Excel, PowerPoint, image or text. Max 25 MB.
            </p>
          </div>
        </form>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setAddOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={onAddSubmit} disabled={pending}>
            Add file
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete manual?"
      >
        <p className="text-sm text-ink">
          This removes the entry and its uploaded file. The action is logged.
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
            onClick={() =>
              confirmDeleteId &&
              wrap(async () => {
                await deleteManual(confirmDeleteId);
                setConfirmDeleteId(null);
              }, "Manual deleted")
            }
            disabled={pending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </ThreePaneLayout>
  );
}

function ManualEditForm({
  form,
  onChange,
  categories,
}: {
  form: EditFormState;
  onChange: (f: EditFormState) => void;
  categories: Category[];
}) {
  const set = <K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label required>Category</Label>
        <Select
          value={form.category_id}
          onChange={(e) => set("category_id", e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label required>Title</Label>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div>
        <Label>Company</Label>
        <Input
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>
      <div>
        <Label>Reference</Label>
        <Input
          value={form.reference}
          onChange={(e) => set("reference", e.target.value)}
        />
      </div>
      <div>
        <Label>Revision no.</Label>
        <Input
          type="number"
          min={0}
          value={form.revision_no}
          onChange={(e) => set("revision_no", e.target.value)}
        />
      </div>
    </div>
  );
}
