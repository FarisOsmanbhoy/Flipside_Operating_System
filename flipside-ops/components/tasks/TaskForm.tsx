"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import { saveTask, type TaskState } from "@/app/(app)/(administration)/tasks/actions";
import type { Task } from "@/lib/database.types";

type LookupItem = { id: string; name: string | null };

export function TaskForm({
  task,
  initialType,
  initialClientId,
  people,
  departments,
  clients,
  priorities,
  categories,
  alertCategories,
  noticeCategories,
}: {
  task?: Task;
  initialType?: "task" | "notice" | "industry_alert";
  initialClientId?: string;
  people: { id: string; full_name: string | null }[];
  departments: LookupItem[];
  clients: LookupItem[];
  priorities: LookupItem[];
  categories: LookupItem[];
  alertCategories: LookupItem[];
  noticeCategories: LookupItem[];
}) {
  const router = useRouter();
  const [type, setType] = useState<Task["type"]>(
    task?.type ?? initialType ?? "task",
  );
  const [state, action, pending] = useActionState<TaskState, FormData>(
    saveTask,
    undefined,
  );

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="type" value={type} />

      <div className="sm:col-span-2">
        <Label htmlFor="type-buttons">Type</Label>
        <div className="flex flex-wrap gap-2" id="type-buttons">
          {(["task", "notice", "industry_alert"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                type === t
                  ? "bg-brand-500 text-white border-brand-500"
                  : "border-border-soft text-muted hover:bg-canvas"
              }`}
            >
              {t === "task" ? "Task" : t === "notice" ? "Notice" : "Industry alert"}
            </button>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="title" required>
          Title
        </Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={task?.title ?? ""}
          autoFocus
        />
        <FieldError message={state?.fieldErrors?.title?.[0]} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={task?.description ?? ""}
        />
      </div>

      {type === "task" && (
        <>
          <div>
            <Label htmlFor="assigned_to">Assignee</Label>
            <Select
              id="assigned_to"
              name="assigned_to"
              defaultValue={task?.assigned_to ?? ""}
            >
              <option value="">— Anyone in dept —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="due_date">Due date</Label>
            <Input
              id="due_date"
              name="due_date"
              type="datetime-local"
              defaultValue={task?.due_date?.slice(0, 16) ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="priority_id">Priority</Label>
            <Select
              id="priority_id"
              name="priority_id"
              defaultValue={task?.priority_id ?? ""}
            >
              <option value="">—</option>
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="category_id">Category</Label>
            <Select
              id="category_id"
              name="category_id"
              defaultValue={task?.category_id ?? ""}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}

      {type === "industry_alert" && (
        <div className="sm:col-span-2">
          <Label htmlFor="alert_category_id">Alert category</Label>
          <Select
            id="alert_category_id"
            name="alert_category_id"
            defaultValue={task?.alert_category_id ?? ""}
          >
            <option value="">—</option>
            {alertCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {type === "notice" && (
        <div className="sm:col-span-2">
          <Label htmlFor="notice_category_id">Notice category</Label>
          <Select
            id="notice_category_id"
            name="notice_category_id"
            defaultValue={task?.notice_category_id ?? ""}
          >
            <option value="">—</option>
            {noticeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="assigned_department">Department scope</Label>
        <Select
          id="assigned_department"
          name="assigned_department"
          defaultValue={task?.assigned_department ?? ""}
        >
          <option value="">Everyone</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="linked_client_id">Linked client (optional)</Label>
        <Select
          id="linked_client_id"
          name="linked_client_id"
          defaultValue={task?.linked_client_id ?? initialClientId ?? ""}
        >
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="needs_prep"
          defaultChecked={task?.needs_prep}
        />
        Needs prep (flag for next stand-up)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="private"
          defaultChecked={task?.private}
        />
        Private (assignee + their manager only)
      </label>

      {state?.error && (
        <div className="sm:col-span-2 text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <div className="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : task ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
