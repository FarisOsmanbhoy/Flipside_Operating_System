import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TaskForm } from "@/components/tasks/TaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; client?: string }>;
}) {
  await getSession();
  const { type, client } = await searchParams;
  const supabase = await createClient();
  const [
    { data: people },
    { data: depts },
    { data: clients },
    { data: priorities },
    { data: categories },
    { data: alertCats },
    { data: noticeCats },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("task_priorities")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("task_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("industry_alert_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("notice_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  return (
    <>
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to tasks
      </Link>
      <PageHeader title="New item" />
      <Card>
        <CardBody>
          <TaskForm
            initialType={(type as "task" | "notice" | "industry_alert") ?? "task"}
            initialClientId={client}
            people={people ?? []}
            departments={depts ?? []}
            clients={clients ?? []}
            priorities={priorities ?? []}
            categories={categories ?? []}
            alertCategories={alertCats ?? []}
            noticeCategories={noticeCats ?? []}
          />
        </CardBody>
      </Card>
    </>
  );
}
