import { getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksListClient } from "@/components/tasks/TasksListClient";

export const dynamic = "force-dynamic";

type TabKey = "task" | "notice" | "industry_alert" | "recurring_template";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: TabKey; mine?: string; q?: string }>;
}) {
  const profile = await getSession();
  const { tab = "task", mine, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, type, title, description, assigned_to, due_date, status, priority_id, linked_client_id, linked_change_request_id, needs_prep, private, recurrence, created_at",
    )
    .eq("type", tab)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (mine === "1") query = query.eq("assigned_to", profile.id);

  // Change-request review tasks are only visible to level 3 admins.
  if (!isAdmin(profile)) query = query.is("linked_change_request_id", null);

  const [
    { data: tasks },
    { data: people },
    { data: clients },
    { data: priorities },
  ] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name"),
    supabase.from("clients").select("id, name"),
    supabase.from("task_priorities").select("id, name"),
  ]);

  const needle = q?.toLowerCase();
  const filtered = needle
    ? (tasks ?? []).filter((t) => t.title.toLowerCase().includes(needle))
    : (tasks ?? []);

  return (
    <>
      <PageHeader title="Tasks & Notices" />

      <TasksListClient
        rows={filtered}
        tab={tab}
        mine={mine}
        q={q}
        people={people ?? []}
        clients={clients ?? []}
        priorities={priorities ?? []}
      />
    </>
  );
}

