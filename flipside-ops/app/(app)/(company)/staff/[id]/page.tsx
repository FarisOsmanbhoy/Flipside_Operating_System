import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Mail,
  Phone,
  Calendar,
  Building2,
  ArrowLeft,
  Briefcase,
  Cake,
  Car,
  Globe,
  Hash,
  Sparkles,
} from "lucide-react";
import { getSession, isAdmin, LEVEL_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/Pill";
import { Card, CardBody } from "@/components/ui/Card";
import { ProfileEditForm } from "@/components/staff/ProfileEditForm";
import { AvatarUploader } from "@/components/staff/AvatarUploader";
import { ChangeMyPasswordCard } from "@/components/staff/ChangeMyPasswordCard";
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

  const canEdit = profile.id === staffMember.id || isAdmin(profile);
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
            <AvatarUploader
              userId={staffMember.id}
              fullName={staffMember.full_name}
              avatarUrl={staffMember.avatar_url}
              canEdit={canEdit}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold">
                  {staffMember.full_name ?? staffMember.email}
                </h1>
                {staffMember.job_title && (
                  <span className="text-sm text-muted">
                    {staffMember.job_title}
                  </span>
                )}
                <Pill
                  tone={
                    staffMember.access_level >= 3
                      ? "brand"
                      : staffMember.access_level >= 2
                        ? "accent"
                        : "neutral"
                  }
                  dot
                >
                  L{staffMember.access_level} ·{" "}
                  {LEVEL_LABELS[staffMember.access_level as 1 | 2 | 3]}
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
                {staffMember.mobile && (
                  <div className="flex items-center gap-2 text-muted">
                    <Phone size={14} />
                    {staffMember.mobile} (mobile)
                  </div>
                )}
                {staffMember.phone && (
                  <div className="flex items-center gap-2 text-muted">
                    <Phone size={14} />
                    {staffMember.phone}
                  </div>
                )}
                {staffMember.extension && (
                  <div className="flex items-center gap-2 text-muted">
                    <Hash size={14} />
                    Ext. {staffMember.extension}
                  </div>
                )}
                {staffMember.job_title && (
                  <div className="flex items-center gap-2 text-muted">
                    <Briefcase size={14} />
                    {staffMember.job_title}
                  </div>
                )}
                {staffMember.start_date && (
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar size={14} />
                    Started {shortDate(staffMember.start_date)}
                  </div>
                )}
                {staffMember.date_of_birth && (
                  <div className="flex items-center gap-2 text-muted">
                    <Cake size={14} />
                    {shortDate(staffMember.date_of_birth)}
                  </div>
                )}
                {staffMember.car_registration && (
                  <div className="flex items-center gap-2 text-muted">
                    <Car size={14} />
                    {staffMember.car_registration}
                  </div>
                )}
                {staffMember.languages && staffMember.languages.length > 0 && (
                  <div className="flex items-center gap-2 text-muted">
                    <Globe size={14} />
                    {staffMember.languages.join(", ")}
                  </div>
                )}
                {staffMember.specialisation && (
                  <div className="flex items-center gap-2 text-muted sm:col-span-2">
                    <Sparkles size={14} />
                    {staffMember.specialisation}
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
                isAdmin={isAdmin(profile)}
                isSelf={profile.id === staffMember.id}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {profile.id === staffMember.id && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Password</h2>
          <Card>
            <CardBody>
              <ChangeMyPasswordCard />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
