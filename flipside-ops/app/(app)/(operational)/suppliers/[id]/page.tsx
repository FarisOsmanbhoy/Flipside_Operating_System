import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { canManage, getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Accordion } from "@/components/ui/Accordion";
import { StalenessBadge } from "@/components/ui/StalenessBadge";
import { SupplierImportantInfoBox } from "@/components/suppliers/SupplierImportantInfoBox";
import { SupplierSectionBodyEditor } from "@/components/suppliers/SupplierSectionBodyEditor";
import { SupplierContactsSection } from "@/components/suppliers/SupplierContactsSection";
import { SupplierAssignedPMPicker } from "@/components/suppliers/SupplierAssignedPMPicker";
import { SuggestFieldButton } from "@/components/import/SuggestFieldButton";
import { timeAgo, shortDate } from "@/lib/format";
import type {
  SupplierSectionType,
  SupplierSectionData,
  SupplierContact,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!supplier) notFound();

  const [
    { data: sectionTypes },
    { data: sectionData },
    { data: contacts },
    { data: pm },
    { data: status },
    { data: type },
    { data: pmCandidates },
  ] = await Promise.all([
    supabase
      .from("supplier_section_types")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    supabase.from("supplier_section_data").select("*").eq("supplier_id", id),
    supabase
      .from("supplier_contacts")
      .select("*")
      .eq("supplier_id", id)
      .order("display_order")
      .order("name"),
    supplier.assigned_pm_id
      ? supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", supplier.assigned_pm_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supplier.status_id
      ? supabase
          .from("supplier_statuses")
          .select("id, name")
          .eq("id", supplier.status_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supplier.type_id
      ? supabase
          .from("supplier_types")
          .select("id, name")
          .eq("id", supplier.type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .gte("access_level", 2)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const canEdit = canManage(profile);
  const canReassignPm = isAdmin(profile);
  const sdMap = new Map(
    (sectionData ?? []).map((d) => [d.section_type_id, d] as const),
  );

  return (
    <>
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to suppliers
      </Link>

      <PageHeader title={supplier.name} />

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {status?.name && (
              <Pill
                tone={
                  status.name === "Active"
                    ? "success"
                    : status.name === "Closed"
                      ? "neutral"
                      : "warning"
                }
              >
                {status.name}
              </Pill>
            )}
            {type?.name && <Pill tone="info">{type.name}</Pill>}
            {!type?.name && isAdmin(profile) && (
              <SuggestFieldButton
                domain="suppliers"
                entityId={supplier.id}
                dbColumn="type_id"
                fieldLabel="type"
              />
            )}
            {!status?.name && isAdmin(profile) && (
              <SuggestFieldButton
                domain="suppliers"
                entityId={supplier.id}
                dbColumn="status_id"
                fieldLabel="status"
              />
            )}
            {supplier.location && (
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <MapPin size={14} /> {supplier.location}
              </span>
            )}
            {supplier.since_date && (
              <span className="text-sm text-muted">
                Since {shortDate(supplier.since_date)}
              </span>
            )}
            <span className="text-xs text-muted ml-auto">
              Updated {timeAgo(supplier.updated_at)}
            </span>
          </div>
          <SupplierAssignedPMPicker
            supplierId={supplier.id}
            currentPm={
              pm
                ? {
                    id: pm.id,
                    full_name: pm.full_name,
                    avatar_url: pm.avatar_url,
                  }
                : null
            }
            candidates={pmCandidates ?? []}
            canEdit={canReassignPm}
          />
        </CardBody>
      </Card>

      <div className="mb-6">
        <SupplierImportantInfoBox
          supplierId={supplier.id}
          value={supplier.important_info}
          canEdit={canEdit}
        />
      </div>

      <div className="space-y-3">
        {(sectionTypes ?? []).map((st: SupplierSectionType) => {
          const sd: SupplierSectionData | undefined = sdMap.get(st.id);
          const body =
            (sd?.data as { body?: string } | null)?.body ?? "";
          return (
            <Accordion
              key={st.id}
              title={st.name}
              defaultOpen={
                st.slug === "overview" ||
                st.slug === "key-contacts" ||
                st.slug === "preferences"
              }
              meta={
                sd?.last_reviewed_at ? (
                  <StalenessBadge date={sd.last_reviewed_at} />
                ) : (
                  <span className="text-xs text-muted italic">No data yet</span>
                )
              }
            >
              {st.slug === "key-contacts" ? (
                <SupplierContactsSection
                  supplierId={supplier.id}
                  contacts={(contacts ?? []) as SupplierContact[]}
                  canEdit={canEdit}
                />
              ) : st.slug === "documents" ? (
                <p className="text-sm text-muted italic">
                  Document attachments arrive in v2.
                </p>
              ) : (
                <SupplierSectionBodyEditor
                  supplierId={supplier.id}
                  sectionTypeId={st.id}
                  body={body}
                  canEdit={canEdit}
                />
              )}
            </Accordion>
          );
        })}
      </div>
    </>
  );
}
