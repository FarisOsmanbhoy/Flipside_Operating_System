import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { LookupEditor } from "@/components/admin/LookupEditor";

export const dynamic = "force-dynamic";

const TABLES = [
  { key: "departments", label: "Departments" },
  { key: "client_statuses", label: "Client statuses" },
  { key: "client_types", label: "Client types" },
  { key: "client_section_types", label: "Client section types" },
  { key: "task_priorities", label: "Task priorities" },
  { key: "task_categories", label: "Task categories" },
  { key: "industry_alert_categories", label: "Industry alert categories" },
  { key: "notice_categories", label: "Notice categories" },
] as const;

export default async function AdminConfigPage() {
  await requireLevel(3);
  const supabase = await createClient();

  const results = await Promise.all(
    TABLES.map((t) =>
      supabase
        .from(t.key)
        .select("id, name, display_order, is_active")
        .order("display_order"),
    ),
  );

  return (
    <>
      <PageHeader
        title="Config"
        subtitle="Add, rename, reorder, or deactivate any lookup. Names sync across the app immediately."
      />
      <div className="space-y-4">
        {TABLES.map((t, i) => (
          <Card key={t.key}>
            <CardHeader>
              <CardTitle>{t.label}</CardTitle>
              <span className="text-xs text-muted">
                {results[i].data?.length ?? 0} items
              </span>
            </CardHeader>
            <CardBody>
              <LookupEditor table={t.key} items={results[i].data ?? []} />
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
