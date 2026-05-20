import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
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
      "id, type, title, description, assigned_to, due_date, status, priority_id, linked_client_id, needs_prep, private, recurrence, created_at",
    )
    .eq("type", tab)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (mine === "1") query = query.eq("assigned_to", profile.id);

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
      <PageHeader
        title="Tasks & Notices"
        actions={
          <Link href={`/tasks/new?type=${tab}`}>
            <Button>
              <Plus size={16} />
              New {labelFor(tab)}
            </Button>
          </Link>
        }
      />

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

function labelFor(t: TabKey) {
  return t === "task"
    ? "task"
    : t === "notice"
      ? "notice"
      : t === "industry_alert"
        ? "industry alert"
        : "recurring";
}
