import { requireLevel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { NewSupplierForm } from "@/components/suppliers/NewSupplierForm";

export default async function NewSupplierPage() {
  await requireLevel(2);

  const supabase = await createClient();
  const [{ data: statuses }, { data: types }, { data: pms }] =
    await Promise.all([
      supabase
        .from("supplier_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("supplier_types")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .gte("access_level", 2)
        .eq("is_active", true)
        .order("full_name"),
    ]);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="New supplier"
        subtitle="The basics — flesh out sections after creating."
      />
      <Card>
        <CardBody>
          <NewSupplierForm
            statuses={statuses ?? []}
            types={types ?? []}
            pms={pms ?? []}
          />
        </CardBody>
      </Card>
    </div>
  );
}
