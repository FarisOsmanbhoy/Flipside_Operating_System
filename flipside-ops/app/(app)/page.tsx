import Link from "next/link";
import { CheckSquare, AlertOctagon, Clock, Briefcase } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { timeAgo, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getSession();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const sixtyAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: openTasks },
    { count: overdueTasks },
    { count: staleClients },
    { count: activeJobs },
    { data: myTasks },
    { data: notices },
    { data: activity },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("type", "task")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "cancelled"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("type", "task")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "cancelled")
      .lt("due_date", nowIso),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .lt("updated_at", sixtyAgo),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select(
        "id, title, due_date, status, priority_id, linked_client_id, type",
      )
      .eq("type", "task")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from("tasks")
      .select("id, title, description, created_at, dismissed_by, type")
      .eq("type", "notice")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_log")
      .select("id, actor_id, entity_type, entity_id, action, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const clientIds = Array.from(
    new Set((myTasks ?? []).map((t) => t.linked_client_id).filter(Boolean)),
  ) as string[];
  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  const actorIds = Array.from(
    new Set((activity ?? []).map((a) => a.actor_id).filter(Boolean)),
  ) as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a]));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile.full_name?.split(" ")[0] ?? "there";
  const overdueCount = overdueTasks ?? 0;
  const summary =
    overdueCount > 0
      ? `${overdueCount} item${overdueCount === 1 ? "" : "s"} need your attention today`
      : (openTasks ?? 0) > 0
        ? `${openTasks} open task${openTasks === 1 ? "" : "s"} on your plate`
        : "Inbox zero — nice.";

  const visibleNotices = (notices ?? []).filter(
    (n) => !(n.dismissed_by ?? []).includes(profile.id),
  );

  return (
    <>
      <RealtimeRefresh />
      <PageHeader title={`${greeting}, ${name}`} subtitle={summary} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<CheckSquare size={18} />}
          label="My open tasks"
          value={openTasks ?? 0}
          href="/tasks?mine=1"
          tone="brand"
        />
        <StatCard
          icon={<AlertOctagon size={18} />}
          label="Overdue"
          value={overdueCount}
          href="/tasks?mine=1"
          tone={overdueCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Stale clients"
          value={staleClients ?? 0}
          href="/clients"
          tone={(staleClients ?? 0) > 0 ? "warning" : "neutral"}
        />
        <StatCard
          icon={<Briefcase size={18} />}
          label="Clients"
          value={activeJobs ?? 0}
          href="/clients"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My tasks</CardTitle>
              <Link
                href="/tasks?mine=1"
                className="text-xs text-brand-700 hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardBody className="!p-0">
              {(myTasks ?? []).length === 0 ? (
                <EmptyState
                  title="No tasks assigned"
                  description="When someone assigns work to you, it'll show here."
                />
              ) : (
                <ul className="divide-y divide-border-soft">
                  {(myTasks ?? []).map((t) => {
                    const overdue =
                      t.due_date && new Date(t.due_date) < new Date();
                    const soon =
                      t.due_date &&
                      !overdue &&
                      new Date(t.due_date).getTime() - Date.now() <
                        1000 * 60 * 60 * 48;
                    const c = t.linked_client_id
                      ? clientMap.get(t.linked_client_id)
                      : null;
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/tasks/${t.id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-canvas"
                        >
                          <Pill
                            tone={
                              overdue ? "danger" : soon ? "warning" : "neutral"
                            }
                          >
                            {t.due_date
                              ? overdue
                                ? "Overdue"
                                : soon
                                  ? "Due soon"
                                  : shortDate(t.due_date)
                              : "No date"}
                          </Pill>
                          <span className="font-medium truncate">{t.title}</span>
                          {c && (
                            <span className="text-xs text-muted truncate">
                              · {c.name}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notices</CardTitle>
              <Link
                href="/tasks?tab=notice"
                className="text-xs text-brand-700 hover:underline"
              >
                All notices
              </Link>
            </CardHeader>
            <CardBody className="!p-0">
              {visibleNotices.length === 0 ? (
                <EmptyState title="Nothing posted" />
              ) : (
                <ul className="divide-y divide-border-soft">
                  {visibleNotices.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <Link
                        href={`/tasks/${n.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {n.title}
                      </Link>
                      {n.description && (
                        <p className="text-xs text-muted line-clamp-2 mt-0.5">
                          {n.description}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardBody className="!p-0">
              {(activity ?? []).length === 0 ? (
                <EmptyState title="Quiet around here." />
              ) : (
                <ul className="divide-y divide-border-soft">
                  {(activity ?? []).map((a) => {
                    const actor = a.actor_id ? actorMap.get(a.actor_id) : null;
                    return (
                      <li
                        key={a.id}
                        className="px-5 py-3 text-sm flex items-start gap-2"
                      >
                        <Pill tone="neutral" className="capitalize">
                          {a.action}
                        </Pill>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            <strong>{actor?.full_name ?? "Someone"}</strong>{" "}
                            <span className="text-muted">
                              {a.action === "create"
                                ? "added"
                                : a.action === "update"
                                  ? "edited"
                                  : "deleted"}
                            </span>{" "}
                            <em>{a.summary ?? a.entity_type}</em>
                          </div>
                          <div className="text-xs text-muted">
                            {timeAgo(a.created_at)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/tasks/new">
          <Button variant="outline">New task</Button>
        </Link>
        <Link href="/tasks/new?type=notice">
          <Button variant="outline">New notice</Button>
        </Link>
        {["admin", "manager"].includes(profile.role) && (
          <Link href="/clients/new">
            <Button variant="outline">New client</Button>
          </Link>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  tone: "brand" | "danger" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger-700"
      : tone === "warning"
        ? "text-warning-700"
        : tone === "brand"
          ? "text-brand-700"
          : "text-ink";
  return (
    <Link href={href}>
      <Card className="hover:border-brand-500 transition-colors h-full">
        <CardBody className="!p-4">
          <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-wide">
            {icon} {label}
          </div>
          <div className={`text-3xl font-semibold mt-2 ${toneClass}`}>
            {value}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
