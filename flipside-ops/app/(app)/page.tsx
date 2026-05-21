import Link from "next/link";
import { canManage, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import {
  TasksNoticesCard,
  ComingSoonCard,
} from "@/components/dashboard/TasksNoticesCard";
import { AlertRibbon } from "@/components/dashboard/AlertRibbon";
import { IndustryInfoPanel } from "@/components/dashboard/IndustryInfoCard";
import { BrandCard } from "@/components/dashboard/BrandCard";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { timeAgo, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getSession();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { count: openTasks },
    { count: overdueTasks },
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

  const departmentName = profile.department_id
    ? (
        await supabase
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .maybeSingle()
      ).data?.name ?? null
    : null;

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

  const tasksPane =
    (myTasks ?? []).length === 0 ? (
      <EmptyState
        title="No tasks assigned"
        description="When someone assigns work to you, it'll show here."
      />
    ) : (
      <ul className="divide-y divide-border-soft">
        {(myTasks ?? []).map((t) => {
          const overdue = t.due_date && new Date(t.due_date) < new Date();
          const soon =
            t.due_date &&
            !overdue &&
            new Date(t.due_date).getTime() - Date.now() < 1000 * 60 * 60 * 48;
          const c = t.linked_client_id ? clientMap.get(t.linked_client_id) : null;
          return (
            <li key={t.id}>
              <Link
                href={`/tasks/${t.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-canvas"
              >
                <Pill tone={overdue ? "danger" : soon ? "warning" : "neutral"}>
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
                  <span className="text-xs text-muted truncate">· {c.name}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    );

  const noticesPane =
    visibleNotices.length === 0 ? (
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
            <p className="text-xs text-muted mt-1">{timeAgo(n.created_at)}</p>
          </li>
        ))}
      </ul>
    );

  const activityPane =
    (activity ?? []).length === 0 ? (
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
                <div className="text-xs text-muted">{timeAgo(a.created_at)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <>
      <RealtimeRefresh />
      <PageHeader title={`${greeting}, ${name}`} subtitle={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside className="space-y-4">
          <BrandCard />
          <ProfileCard
            userId={profile.id}
            fullName={profile.full_name}
            email={profile.email}
            avatarUrl={profile.avatar_url}
            departmentName={departmentName}
          />
        </aside>

        <div className="flex flex-col gap-4 min-w-0">
          <AlertRibbon
            notice={
              visibleNotices[0]
                ? {
                    id: visibleNotices[0].id,
                    title: visibleNotices[0].title,
                    created_at: visibleNotices[0].created_at,
                  }
                : null
            }
          />
          <TasksNoticesCard
            industryPane={<IndustryInfoPanel />}
            tasksPane={tasksPane}
            noticesPane={noticesPane}
            activityPane={activityPane}
            counts={{
              tasks: openTasks ?? 0,
              notices: visibleNotices.length,
              activity: (activity ?? []).length,
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComingSoonCard
              title="Suggestions & Feedback"
              description="Submit ideas and feedback in a lightweight inbox — coming soon."
            />
            <ComingSoonCard
              title="Training"
              description="Track training modules and completions per staff member."
            />
            <ComingSoonCard
              title="Polls"
              description="Quick polls for the team — coming soon."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/tasks/new">
              <Button variant="outline">New task</Button>
            </Link>
            <Link href="/tasks/new?type=notice">
              <Button variant="outline">New notice</Button>
            </Link>
            {canManage(profile) && (
              <Link href="/clients/new">
                <Button variant="outline">New client</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
