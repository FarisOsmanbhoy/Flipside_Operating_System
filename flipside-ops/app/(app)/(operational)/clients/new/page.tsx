import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { NewClientForm } from "@/components/clients/NewClientForm";

export default async function NewClientPage() {
  await requireRole("admin", "manager");

  const supabase = await createClient();
  const [{ data: statuses }, { data: types }, { data: pms }] =
    await Promise.all([
      supabase
        .from("client_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("client_types")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["admin", "manager"])
        .eq("is_active", true)
        .order("full_name"),
    ]);

  return (
    <>
      <PageHeader
        title="New client"
        subtitle="The basics — flesh out sections after creating."
      />
      <Card>
        <CardBody>
          <NewClientForm
            statuses={statuses ?? []}
            types={types ?? []}
            pms={pms ?? []}
          />
        </CardBody>
      </Card>
    </>
  );
}
