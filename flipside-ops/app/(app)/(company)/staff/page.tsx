import Link from "next/link";
import { UserPlus } from "lucide-react";
import { getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StaffListClient } from "@/components/staff/StaffListClient";

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
        "id, full_name, email, access_level, phone, mobile, department_id, avatar_url, is_active, job_title",
      )
      .order("full_name", { ascending: true }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

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
          isAdmin(profile) ? (
            <Link href="/admin/users">
              <Button>
                <UserPlus size={16} />
                Invite
              </Button>
            </Link>
          ) : undefined
        }
      />

      <StaffListClient
        rows={filtered}
        departments={depts ?? []}
        initialQ={q}
        initialDept={dept}
      />
    </>
  );
}
