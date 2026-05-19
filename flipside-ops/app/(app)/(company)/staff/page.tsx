import Link from "next/link";
import { Mail, Phone, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StaffFilters } from "@/components/staff/StaffFilters";
import { ListPageLayout } from "@/components/layout/ListPageLayout";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const profile = await getSession();
  const supabase = await createClient();
  const { q, dept } = await searchParams;

  const [{ data: staff }, { data: depts }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, phone, mobile, department_id, avatar_url, is_active",
      )
      .order("full_name", { ascending: true }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));

  const filtered = (staff ?? []).filter((s) => {
    if (!s.is_active) return false;
    if (dept && s.department_id !== dept) return false;
    if (q) {
      const needle = q.toLowerCase();
      return (
        (s.full_name ?? "").toLowerCase().includes(needle) ||
        s.email.toLowerCase().includes(needle)
      );
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${filtered.length} of ${staff?.length ?? 0} active`}
        actions={
          profile.role === "admin" ? (
            <Link href="/admin/users">
              <Button>
                <UserPlus size={16} />
                Invite
              </Button>
            </Link>
          ) : undefined
        }
      />

      <ListPageLayout
        sidebar={
          <StaffFilters
            departments={depts ?? []}
            initialQ={q}
            initialDept={dept}
          />
        }
      >
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No staff match"
            description="Try clearing filters or check the spelling."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas border-b border-border-soft text-left text-xs text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link
                        href={`/staff/${s.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <Avatar
                          name={s.full_name}
                          src={s.avatar_url}
                          size={36}
                        />
                        <span className="font-medium group-hover:text-brand-700">
                          {s.full_name ?? s.email}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Pill
                        tone={
                          s.role === "admin"
                            ? "brand"
                            : s.role === "manager"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {s.role}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {s.department_id ? deptMap.get(s.department_id) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={`mailto:${s.email}`}
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                      >
                        <Mail size={14} /> {s.email}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {s.phone ?? s.mobile ? (
                        <a
                          href={`tel:${s.phone ?? s.mobile}`}
                          className="inline-flex items-center gap-1 hover:text-brand-700"
                        >
                          <Phone size={14} /> {s.phone ?? s.mobile}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </ListPageLayout>
    </>
  );
}
