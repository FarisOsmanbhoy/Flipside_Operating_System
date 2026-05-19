import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "task", label: "Tasks" },
  { key: "notice", label: "Notices" },
  { key: "industry_alert", label: "Industry alerts" },
  { key: "recurring_template", label: "Recurring" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: TabKey; mine?: string }>;
}) {
  const profile = await getSession();
  const { tab = "task", mine } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("tasks")
    .select(
      "id, type, title, description, assigned_to, due_date, status, priority_id, linked_client_id, needs_prep, private, recurrence, created_at",
    )
    .eq("type", tab)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (mine === "1") q = q.eq("assigned_to", profile.id);

  const [
    { data: tasks },
    { data: people },
    { data: clients },
    { data: priorities },
  ] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name"),
    supabase.from("clients").select("id, name"),
    supabase.from("task_priorities").select("id, name"),
  ]);

  const peopleMap = new Map((people ?? []).map((p) => [p.id, p]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
  const priorityMap = new Map((priorities ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title="Tasks &amp; Notices"
        actions={
          <Link href={`/tasks/new?type=${tab}`}>
            <Button>
              <Plus size={16} />
              New {labelFor(tab)}
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tasks?tab=${t.key}${mine === "1" ? "&mine=1" : ""}`}
            className={`px-3 py-1 text-sm rounded-lg border ${
              tab === t.key
                ? "bg-brand-500 text-white border-brand-500"
                : "border-border-soft text-muted hover:bg-canvas"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <div className="ml-auto" />
        <Link
          href={`/tasks?tab=${tab}${mine === "1" ? "" : "&mine=1"}`}
          className={`px-3 py-1 text-sm rounded-lg border ${
            mine === "1"
              ? "bg-accent-500 text-brand-900 border-accent-500"
              : "border-border-soft text-muted hover:bg-canvas"
          }`}
        >
          {mine === "1" ? "Showing: mine" : "Show only mine"}
        </Link>
      </div>

      {(tasks ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title={`No ${labelFor(tab)}s`}
            description="When there are some, they'll show here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas border-b border-border-soft text-left text-xs text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Assignee</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {(tasks ?? []).map((t) => {
                  const overdue =
                    t.due_date &&
                    new Date(t.due_date) < new Date() &&
                    t.status !== "done";
                  const dueSoon =
                    t.due_date &&
                    !overdue &&
                    new Date(t.due_date).getTime() - Date.now() <
                      1000 * 60 * 60 * 48;
                  return (
                    <tr
                      key={t.id}
                      className={
                        overdue
                          ? "bg-danger-50/40 hover:bg-danger-50"
                          : dueSoon
                            ? "bg-warning-50/40 hover:bg-warning-50"
                            : "hover:bg-canvas"
                      }
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="font-medium hover:text-brand-700"
                        >
                          {t.title}
                        </Link>
                        <div className="flex gap-1 mt-1">
                          {t.priority_id && (
                            <Pill tone="neutral">
                              {priorityMap.get(t.priority_id) ?? "—"}
                            </Pill>
                          )}
                          {t.needs_prep && (
                            <Pill tone="warning">Needs prep</Pill>
                          )}
                          {t.private && <Pill tone="brand">Private</Pill>}
                          {t.recurrence !== "none" && (
                            <Pill tone="accent">{t.recurrence}</Pill>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          tone={
                            t.status === "done"
                              ? "success"
                              : t.status === "cancelled"
                                ? "neutral"
                                : t.status === "in_progress"
                                  ? "info"
                                  : overdue
                                    ? "danger"
                                    : "warning"
                          }
                        >
                          {t.status.replace("_", " ")}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.due_date ? (
                          <span
                            className={
                              overdue
                                ? "text-danger-700 font-medium"
                                : dueSoon
                                  ? "text-warning-700"
                                  : "text-muted"
                            }
                          >
                            {shortDate(t.due_date)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {t.assigned_to
                          ? (peopleMap.get(t.assigned_to)?.full_name ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.linked_client_id ? (
                          <Link
                            href={`/clients/${t.linked_client_id}`}
                            className="text-brand-700 hover:underline"
                          >
                            {clientMap.get(t.linked_client_id)?.name ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-muted mt-3">
        {(tasks ?? []).length} item{(tasks ?? []).length === 1 ? "" : "s"} —
        sorted by due date. Recent activity also visible on the dashboard.
        Last refresh: {timeAgo(new Date())}.
      </p>
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
