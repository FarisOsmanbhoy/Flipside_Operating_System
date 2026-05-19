import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Calendar, Building2, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { Card, CardBody } from "@/components/ui/Card";
import { ProfileEditForm } from "@/components/staff/ProfileEditForm";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSession();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: staffMember }, { data: depts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  if (!staffMember) notFound();

  const canEdit =
    profile.id === staffMember.id || profile.role === "admin";
  const dept = depts?.find((d) => d.id === staffMember.department_id);

  return (
    <>
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to staff
      </Link>

      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar
              name={staffMember.full_name}
              src={staffMember.avatar_url}
              size={96}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold">
                  {staffMember.full_name ?? staffMember.email}
                </h1>
                <Pill
                  tone={
                    staffMember.role === "admin"
                      ? "brand"
                      : staffMember.role === "manager"
                        ? "accent"
                        : "neutral"
                  }
                >
                  {staffMember.role}
                </Pill>
                {!staffMember.is_active && (
                  <Pill tone="danger">Inactive</Pill>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 mt-4 text-sm">
                <div className="flex items-center gap-2 text-muted">
                  <Mail size={14} />
                  <a
                    href={`mailto:${staffMember.email}`}
                    className="text-brand-700 hover:underline"
                  >
                    {staffMember.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Building2 size={14} />
                  {dept?.name ?? "No department"}
                </div>
                {staffMember.phone && (
                  <div className="flex items-center gap-2 text-muted">
                    <Phone size={14} />
                    {staffMember.phone}
                  </div>
                )}
                {staffMember.mobile && (
                  <div className="flex items-center gap-2 text-muted">
                    <Phone size={14} />
                    {staffMember.mobile} (mobile)
                  </div>
                )}
                {staffMember.start_date && (
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar size={14} />
                    Started {shortDate(staffMember.start_date)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {canEdit && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Edit profile</h2>
          <Card>
            <CardBody>
              <ProfileEditForm
                profile={staffMember}
                departments={depts ?? []}
                isAdmin={profile.role === "admin"}
                isSelf={profile.id === staffMember.id}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
