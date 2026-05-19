"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

const TaskBase = z.object({
  id: z.uuid().optional(),
  type: z.enum(["task", "notice", "industry_alert", "recurring_template"]),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  assigned_to: z.uuid().optional().or(z.literal("")),
  assigned_department: z.uuid().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  priority_id: z.uuid().optional().or(z.literal("")),
  category_id: z.uuid().optional().or(z.literal("")),
  alert_category_id: z.uuid().optional().or(z.literal("")),
  notice_category_id: z.uuid().optional().or(z.literal("")),
  linked_client_id: z.uuid().optional().or(z.literal("")),
  needs_prep: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
  private: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
  recurrence: z
    .enum(["none", "daily", "weekly", "monthly", "yearly"])
    .optional(),
});

export type TaskState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function saveTask(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  await getSession();
  const parsed = TaskBase.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const payload = {
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description || null,
    assigned_to: parsed.data.assigned_to || null,
    assigned_department: parsed.data.assigned_department || null,
    due_date: parsed.data.due_date || null,
    priority_id: parsed.data.priority_id || null,
    category_id: parsed.data.category_id || null,
    alert_category_id: parsed.data.alert_category_id || null,
    notice_category_id: parsed.data.notice_category_id || null,
    linked_client_id: parsed.data.linked_client_id || null,
    needs_prep: !!parsed.data.needs_prep,
    private: !!parsed.data.private,
    recurrence: parsed.data.recurrence ?? "none",
  };
  const { data, error } = parsed.data.id
    ? await supabase
        .from("tasks")
        .update(payload)
        .eq("id", parsed.data.id)
        .select("id")
        .single()
    : await supabase.from("tasks").insert(payload).select("id").single();
  if (error || !data) return { error: error?.message ?? "Save failed." };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${data.id}`);
  revalidatePath("/");
  redirect(`/tasks/${data.id}`);
}

export async function setTaskStatus(input: {
  id: string;
  status: "open" | "in_progress" | "done" | "cancelled";
}) {
  await getSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: input.status,
      completed_at: input.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${input.id}`);
  revalidatePath("/");
}

export async function convertToRecurring(input: {
  id: string;
  recurrence: "daily" | "weekly" | "monthly" | "yearly";
}) {
  await getSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      type: "recurring_template",
      recurrence: input.recurrence,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${input.id}`);
}

export async function dismissNotice(id: string) {
  const profile = await getSession();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("dismissed_by")
    .eq("id", id)
    .maybeSingle();
  const next = Array.from(new Set([...(task?.dismissed_by ?? []), profile.id]));
  const { error } = await supabase
    .from("tasks")
    .update({ dismissed_by: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/tasks");
}

const CommentSchema = z.object({
  task_id: z.uuid(),
  body: z.string().min(1).max(2000),
});

export async function addComment(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const profile = await getSession();
  const parsed = CommentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    author_id: profile.id,
    body: parsed.data.body,
  });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${parsed.data.task_id}`);
  return {};
}
