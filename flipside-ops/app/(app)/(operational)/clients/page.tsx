import Link from "next/link";
import { Plus } from "lucide-react";
import { canManage, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ClientsListClient } from "@/components/clients/ClientsListClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await getSession();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: statuses }, { data: pms }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, name, location, important_info, updated_at, status_id, assigned_pm_id",
        )
        .order("name"),
      supabase
        .from("client_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);

  const filtered = (clients ?? []).filter((c) => {
    if (status && c.status_id !== status) return false;
    if (q) {
      const needle = q.toLowerCase();
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.important_info ?? "").toLowerCase().includes(needle) ||
        (c.location ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const canCreate = canManage(profile);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} of ${clients?.length ?? 0}`}
        actions={
          canCreate ? (
            <Link href="/clients/new">
              <Button>
                <Plus size={16} />
                New client
              </Button>
            </Link>
          ) : undefined
        }
      />

      <ClientsListClient
        rows={filtered}
        statuses={statuses ?? []}
        pms={pms ?? []}
        initialQ={q}
        initialStatus={status}
        canEdit={canCreate}
      />
    </>
  );
}
