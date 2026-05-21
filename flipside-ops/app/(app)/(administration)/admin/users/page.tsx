import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminUsersListClient } from "@/components/admin/AdminUsersListClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await requireLevel(3);
  const supabase = await createClient();

  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("is_active", { ascending: false })
      .order("full_name"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  return (
    <>
      <PageHeader title="Users" subtitle={`${users?.length ?? 0} total`} />

      <AdminUsersListClient
        users={users ?? []}
        departments={departments ?? []}
        currentUserId={me.id}
      />
    </>
  );
}
