import Link from "next/link";

import { requireLevel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { DiagnosticsClient } from "./DiagnosticsClient";

export const dynamic = "force-dynamic";

type FindingRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  issue_type: string;
  severity: string;
  suggestion: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  dismissed_at: string | null;
  acted_at: string | null;
};

export default async function DiagnosticsPage() {
  await requireLevel(3);
  const supabase = await createClient();

  // Open findings (not dismissed), newest first.
  const { data: findingsRaw } = await supabase
    .from("ai_diagnostics")
    .select(
      "id, entity_type, entity_id, issue_type, severity, suggestion, payload, created_at, dismissed_at, acted_at",
    )
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  const findings = (findingsRaw ?? []) as FindingRow[];

  // Look up entity names so findings can show "Acme Builders" not just a uuid.
  const clientIds = findings
    .filter((f) => f.entity_type === "client")
    .map((f) => f.entity_id);
  const supplierIds = findings
    .filter((f) => f.entity_type === "supplier")
    .map((f) => f.entity_id);

  const [clientsRes, suppliersRes] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supplierIds.length
      ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameMap: Record<string, string> = {};
  for (const c of clientsRes.data ?? []) nameMap[`client:${c.id}`] = c.name;
  for (const s of suppliersRes.data ?? []) nameMap[`supplier:${s.id}`] = s.name;

  return (
    <>
      <PageHeader
        title="AI diagnostics"
        subtitle="Run an AI scan for data-quality issues across clients and suppliers. Findings are admin-only."
      />

      <DiagnosticsClient findings={findings} nameMap={nameMap} />

      <p className="mt-6 text-xs text-muted">
        Passwords are excluded from the scanner for privacy.{" "}
        <Link
          href="/admin/audit"
          className="underline hover:no-underline"
        >
          View AI usage log →
        </Link>
      </p>
    </>
  );
}
