import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("admin");
  const supabase = await createClient();
  const page = Math.max(0, parseInt((await searchParams).page ?? "0", 10) || 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: entries, count } = await supabase
    .from("audit_log")
    .select("id, actor_id, entity_type, entity_id, action, summary, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const actorIds = Array.from(
    new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean)),
  ) as string[];
  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a]));

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${count ?? 0} total entries`}
      />
      {(entries ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing logged"
            description="Edits will show up here automatically."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas border-b border-border-soft text-left text-xs text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Who</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entity</th>
                  <th className="px-5 py-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {(entries ?? []).map((e) => {
                  const actor = e.actor_id ? actorMap.get(e.actor_id) : null;
                  return (
                    <tr key={e.id} className="hover:bg-canvas">
                      <td className="px-5 py-2 text-xs text-muted whitespace-nowrap">
                        {timeAgo(e.created_at)}
                      </td>
                      <td className="px-5 py-2">
                        {actor?.full_name ?? actor?.email ?? "—"}
                      </td>
                      <td className="px-5 py-2">
                        <Pill
                          tone={
                            e.action === "create"
                              ? "success"
                              : e.action === "delete"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {e.action}
                        </Pill>
                      </td>
                      <td className="px-5 py-2 text-xs text-muted">
                        {e.entity_type}
                      </td>
                      <td className="px-5 py-2 truncate max-w-md">
                        {e.summary ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <Link
            href={`/admin/audit?page=${Math.max(0, page - 1)}`}
            aria-disabled={page === 0}
            className={`px-3 py-1 rounded border ${
              page === 0
                ? "border-border-soft text-muted pointer-events-none opacity-50"
                : "border-border-soft hover:bg-canvas"
            }`}
          >
            Previous
          </Link>
          <span className="text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <Link
            href={`/admin/audit?page=${page + 1}`}
            aria-disabled={page + 1 >= totalPages}
            className={`px-3 py-1 rounded border ${
              page + 1 >= totalPages
                ? "border-border-soft text-muted pointer-events-none opacity-50"
                : "border-border-soft hover:bg-canvas"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </>
  );
}
