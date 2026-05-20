import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canManage, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { RequestChangeForm } from "@/components/clients/RequestChangeForm";

export const dynamic = "force-dynamic";

export default async function RequestChangePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSession();
  // Admin/manager can use the in-line edit flows; this form is for editors.
  if (canManage(profile)) {
    redirect(`/clients/${(await params).id}`);
  }

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: sectionTypes }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_section_types")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("display_order"),
  ]);
  if (!client) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to {client.name}
      </Link>
      <PageHeader
        title="Request a change"
        subtitle={`A manager will review your suggested edit to ${client.name}.`}
      />
      <Card>
        <CardBody>
          <RequestChangeForm
            clientId={client.id}
            sectionTypes={sectionTypes ?? []}
          />
        </CardBody>
      </Card>
    </div>
  );
}
