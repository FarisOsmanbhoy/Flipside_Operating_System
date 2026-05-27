import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { canManage, getSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { StalenessBadge } from "@/components/ui/StalenessBadge";
import { ImportantInfoBox } from "@/components/clients/ImportantInfoBox";
import { SectionBodyEditor } from "@/components/clients/SectionBodyEditor";
import { ContactsSection } from "@/components/clients/ContactsSection";
import { SubcontractorsSection } from "@/components/clients/SubcontractorsSection";
import { AssignedPMPicker } from "@/components/clients/AssignedPMPicker";
import { SuggestFieldButton } from "@/components/import/SuggestFieldButton";
import { timeAgo, shortDate } from "@/lib/format";
import type {
  ClientSectionType,
  ClientSectionData,
  ClientContact,
  ClientSubcontractor,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  const [
    { data: sectionTypes },
    { data: sectionData },
    { data: contacts },
    { data: subs },
    { data: pm },
    { data: status },
    { data: type },
    { data: pmCandidates },
  ] = await Promise.all([
    supabase
      .from("client_section_types")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    supabase.from("client_section_data").select("*").eq("client_id", id),
    supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", id)
      .order("display_order")
      .order("name"),
    supabase
      .from("client_subcontractors")
      .select("*")
      .eq("client_id", id)
      .order("trade")
      .order("company_name"),
    client.assigned_pm_id
      ? supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", client.assigned_pm_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.status_id
      ? supabase
          .from("client_statuses")
          .select("id, name")
          .eq("id", client.status_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.type_id
      ? supabase
          .from("client_types")
          .select("id, name")
          .eq("id", client.type_id)
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
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <PageHeader
        title={client.name}
        actions={
          !canEdit ? (
            <Link href={`/clients/${client.id}/request-change`}>
              <Button variant="outline">Request change</Button>
            </Link>
          ) : undefined
        }
      />

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
                domain="clients"
                entityId={client.id}
                dbColumn="type_id"
                fieldLabel="type"
              />
            )}
            {!status?.name && isAdmin(profile) && (
              <SuggestFieldButton
                domain="clients"
                entityId={client.id}
                dbColumn="status_id"
                fieldLabel="status"
              />
            )}
            {client.location && (
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <MapPin size={14} /> {client.location}
              </span>
            )}
            {client.since_date && (
              <span className="text-sm text-muted">
                Since {shortDate(client.since_date)}
              </span>
            )}
            <span className="text-xs text-muted ml-auto">
              Updated {timeAgo(client.updated_at)}
            </span>
          </div>
          <AssignedPMPicker
            clientId={client.id}
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
        <ImportantInfoBox
          clientId={client.id}
          value={client.important_info}
          canEdit={canEdit}
        />
      </div>

      <div className="space-y-3">
        {(sectionTypes ?? []).map((st: ClientSectionType) => {
          const sd: ClientSectionData | undefined = sdMap.get(st.id);
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
                <ContactsSection
                  clientId={client.id}
                  contacts={(contacts ?? []) as ClientContact[]}
                  canEdit={canEdit}
                />
              ) : st.slug === "subcontractors" ? (
                <SubcontractorsSection
                  clientId={client.id}
                  subs={(subs ?? []) as ClientSubcontractor[]}
                  canEdit={canEdit}
                />
              ) : st.slug === "documents" ? (
                <p className="text-sm text-muted italic">
                  Document attachments arrive in v2.
                </p>
              ) : (
                <SectionBodyEditor
                  clientId={client.id}
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
