import { canManage, getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportButton } from "@/components/import/ImportButton";
import { SuppliersListClient } from "@/components/suppliers/SuppliersListClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await getSession();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  const [{ data: suppliers }, { data: statuses }, { data: pms }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select(
          "id, name, location, important_info, updated_at, status_id, assigned_pm_id",
        )
        .order("name"),
      supabase
        .from("supplier_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);

  const filtered = (suppliers ?? []).filter((s) => {
    if (status && s.status_id !== status) return false;
    if (q) {
      const needle = q.toLowerCase();
      return (
        s.name.toLowerCase().includes(needle) ||
        (s.important_info ?? "").toLowerCase().includes(needle) ||
        (s.location ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const canCreate = canManage(profile);

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={`${filtered.length} of ${suppliers?.length ?? 0}`}
        actions={isAdmin(profile) ? <ImportButton domain="suppliers" /> : null}
      />

      <SuppliersListClient
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
