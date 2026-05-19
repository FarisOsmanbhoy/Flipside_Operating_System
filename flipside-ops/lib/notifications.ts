import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  kind: "task_due" | "task_overdue" | "change_request_decision";
  title: string;
  subtitle?: string;
  href: string;
  created_at: string;
};

export async function getNotifications(userId: string): Promise<Notification[]> {
  const supabase = await createClient();

  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const now = new Date().toISOString();

  const [tasksRes, decisionsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("assigned_to", userId)
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", sevenDaysOut.toISOString())
      .order("due_date", { ascending: true })
      .limit(10),
    supabase
      .from("change_requests")
      .select("id, client_id, summary, status, reviewed_at, decision_notes")
      .eq("requested_by", userId)
      .in("status", ["approved", "rejected"])
      .gte("reviewed_at", fourteenDaysAgo.toISOString())
      .order("reviewed_at", { ascending: false })
      .limit(10),
  ]);

  const notifications: Notification[] = [];

  for (const t of tasksRes.data ?? []) {
    const overdue = t.due_date && t.due_date < now;
    notifications.push({
      id: `task-${t.id}`,
      kind: overdue ? "task_overdue" : "task_due",
      title: t.title,
      subtitle: overdue ? "Overdue" : "Due soon",
      href: `/tasks/${t.id}`,
      created_at: t.due_date ?? new Date().toISOString(),
    });
  }

  for (const cr of decisionsRes.data ?? []) {
    notifications.push({
      id: `cr-${cr.id}`,
      kind: "change_request_decision",
      title: cr.summary,
      subtitle: `Change request ${cr.status}`,
      href: `/clients/${cr.client_id}`,
      created_at: cr.reviewed_at ?? new Date().toISOString(),
    });
  }

  return notifications.sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}
