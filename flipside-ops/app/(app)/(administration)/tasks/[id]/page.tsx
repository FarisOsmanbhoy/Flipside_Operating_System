import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TaskActions } from "@/components/tasks/TaskActions";
import { CommentsThread } from "@/components/tasks/CommentsThread";
import { shortDate, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!task) notFound();

  const [{ data: assignee }, { data: client }, { data: comments }] =
    await Promise.all([
      task.assigned_to
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", task.assigned_to)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      task.linked_client_id
        ? supabase
            .from("clients")
            .select("id, name")
            .eq("id", task.linked_client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("task_comments")
        .select("id, task_id, author_id, body, created_at")
        .eq("task_id", id)
        .order("created_at"),
    ]);

  const authorIds = Array.from(
    new Set((comments ?? []).map((c) => c.author_id)),
  );
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds)
    : { data: [] };

  return (
    <>
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to tasks
      </Link>

      <PageHeader title={task.title} />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Pill tone="info">{task.type.replace("_", " ")}</Pill>
            <Pill
              tone={
                task.status === "done"
                  ? "success"
                  : task.status === "cancelled"
                    ? "neutral"
                    : "warning"
              }
            >
              {task.status.replace("_", " ")}
            </Pill>
            {task.recurrence !== "none" && (
              <Pill tone="accent">{task.recurrence}</Pill>
            )}
            {task.needs_prep && <Pill tone="warning">Needs prep</Pill>}
            {task.private && <Pill tone="brand">Private</Pill>}
            <span className="text-xs text-muted ml-auto">
              Created {timeAgo(task.created_at)}
            </span>
          </div>

          {task.description && (
            <p className="text-sm whitespace-pre-wrap mb-4">
              {task.description}
            </p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {task.due_date && (
              <div>
                <dt className="text-xs text-muted uppercase">Due</dt>
                <dd>{shortDate(task.due_date)}</dd>
              </div>
            )}
            {assignee && (
              <div>
                <dt className="text-xs text-muted uppercase">Assigned to</dt>
                <dd>{assignee.full_name}</dd>
              </div>
            )}
            {client && (
              <div>
                <dt className="text-xs text-muted uppercase">Linked client</dt>
                <dd>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {client.name}
                  </Link>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 pt-4 border-t border-border-soft">
            <TaskActions task={task} />
          </div>
        </CardBody>
      </Card>

      <h2 className="text-lg font-semibold mb-2">Comments</h2>
      <CommentsThread
        taskId={task.id}
        comments={comments ?? []}
        authors={authors ?? []}
      />
    </>
  );
}
