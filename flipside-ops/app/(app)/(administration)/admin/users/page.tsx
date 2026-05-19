import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { InviteUserButton } from "@/components/admin/InviteUserButton";
import { UserRow } from "@/components/admin/UserRow";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole("admin");
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
      <PageHeader
        title="Users"
        subtitle={`${users?.length ?? 0} total`}
        actions={<InviteUserButton departments={departments ?? []} />}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-canvas border-b border-border-soft text-left text-xs text-muted uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {(users ?? []).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  display={
                    <>
                      <Avatar
                        name={u.full_name}
                        src={u.avatar_url}
                        size={28}
                      />
                      <span className="font-medium">
                        {u.full_name ?? u.email}
                      </span>
                    </>
                  }
                  statusPill={
                    u.is_active ? (
                      <Pill tone="success">Active</Pill>
                    ) : (
                      <Pill tone="danger">Inactive</Pill>
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
