import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuditListClient } from "@/components/admin/AuditListClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireLevel(3);
  const supabase = await createClient();
  const page = Math.max(0, parseInt((await searchParams).page ?? "0", 10) || 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: entries, count } = await supabase
    .from("audit_log")
    .select(
      "id, actor_id, entity_type, entity_id, action, summary, created_at",
      { count: "exact" },
    )
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

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${count ?? 0} total entries`} />

      <AuditListClient rows={entries ?? []} actors={actors ?? []} />

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
