import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireLevel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ChangeRequestsListClient,
  type ChangeRow,
} from "@/components/clients/ChangeRequestsListClient";

export const dynamic = "force-dynamic";

export default async function ChangeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: "pending" | "approved" | "rejected" }>;
}) {
  await requireLevel(2);
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
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null; email: string }[],
          }),
      supabase.from("client_section_types").select("id, name"),
    ]);

  return (
    <>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>
      <PageHeader title="Change requests" subtitle={`Status: ${status}`} />

      <ChangeRequestsListClient
        rows={(requests ?? []) as unknown as ChangeRow[]}
        status={status}
        clients={clients ?? []}
        people={people ?? []}
        sections={sections ?? []}
      />
    </>
  );
}
