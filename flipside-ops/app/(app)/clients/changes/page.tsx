import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { ChangeRequestActions } from "@/components/clients/ChangeRequestActions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChangeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin", "manager");
  const supabase = await createClient();
  const { status = "pending" } = await searchParams;

  const { data: requests } = await supabase
    .from("change_requests")
    .select(
      "id, client_id, section_type_id, requested_by, summary, status, reviewed_by, reviewed_at, decision_notes, created_at",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  const clientIds = Array.from(
    new Set((requests ?? []).map((r) => r.client_id)),
  );
  const requesterIds = Array.from(
    new Set((requests ?? []).map((r) => r.requested_by)),
  );

  const [{ data: clients }, { data: people }, { data: sections }] =
    await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      requesterIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", requesterIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
      supabase
        .from("client_section_types")
        .select("id, name"),
    ]);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
  const peopleMap = new Map((people ?? []).map((p) => [p.id, p]));
  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name]));

  return (
    <>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>
      <PageHeader title="Change requests" subtitle={`Status: ${status}`} />

      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/clients/changes?status=${s}`}
            className={`px-3 py-1 text-sm rounded-lg border ${
              status === s
                ? "bg-brand-500 text-white border-brand-500"
                : "border-border-soft text-muted hover:bg-canvas"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {(requests ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing to review"
            description="No change requests with this status."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {(requests ?? []).map((r) => {
            const client = clientMap.get(r.client_id);
            const requester = peopleMap.get(r.requested_by);
            return (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/clients/${r.client_id}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {client?.name ?? "Unknown client"}
                        </Link>
                        {r.section_type_id && (
                          <Pill tone="info">
                            {sectionMap.get(r.section_type_id) ?? "—"}
                          </Pill>
                        )}
                        <span className="text-xs text-muted">
                          {timeAgo(r.created_at)} ·{" "}
                          {requester?.full_name ?? requester?.email ?? "—"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {r.summary}
                      </p>
                      {r.decision_notes && (
                        <p className="text-xs text-muted mt-2 italic">
                          Decision notes: {r.decision_notes}
                        </p>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <ChangeRequestActions id={r.id} />
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
