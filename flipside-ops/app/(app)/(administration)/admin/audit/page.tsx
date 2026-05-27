import Link from "next/link";
import { Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireLevel } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AuditListClient } from "@/components/admin/AuditListClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireLevel(3);
  const supabase = await createClient();
  const page = Math.max(0, parseInt((await searchParams).page ?? "0", 10) || 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: entries, count } = await supabase
    .from("audit_log")
    .select(
      "id, actor_id, entity_type, entity_id, action, summary, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const actorIds = Array.from(
    new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean)),
  ) as string[];
  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [] };

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // AI usage summary — newest 10 + totals. Stays cheap because the table
  // is small until the AI features see real traffic.
  const { data: aiUsage } = await supabase
    .from("ai_usage_log")
    .select("id, endpoint, model, input_tokens, output_tokens, cost_usd, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: aiTotals } = await supabase
    .from("ai_usage_log")
    .select("cost_usd, input_tokens, output_tokens");
  const totalCost =
    (aiTotals ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  const totalInput =
    (aiTotals ?? []).reduce((sum, r) => sum + Number(r.input_tokens ?? 0), 0);
  const totalOutput =
    (aiTotals ?? []).reduce((sum, r) => sum + Number(r.output_tokens ?? 0), 0);
  const callCount = (aiTotals ?? []).length;

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${count ?? 0} total entries`} />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={14} className="text-brand-500" /> AI usage
          </h2>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <Stat label="Total calls" value={callCount.toLocaleString()} />
            <Stat label="Total cost" value={`$${totalCost.toFixed(4)}`} />
            <Stat label="Input tokens" value={totalInput.toLocaleString()} />
            <Stat label="Output tokens" value={totalOutput.toLocaleString()} />
          </div>
          {aiUsage && aiUsage.length > 0 ? (
            <div className="overflow-hidden rounded border border-border-soft">
              <table className="w-full text-xs">
                <thead className="bg-canvas text-left uppercase text-muted">
                  <tr>
                    <th className="px-2 py-1.5">When</th>
                    <th className="px-2 py-1.5">Endpoint</th>
                    <th className="px-2 py-1.5">Model</th>
                    <th className="px-2 py-1.5 text-right">In / Out</th>
                    <th className="px-2 py-1.5 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {aiUsage.map((r) => (
                    <tr key={r.id} className="border-t border-border-soft">
                      <td className="px-2 py-1.5 text-muted">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{r.endpoint}</td>
                      <td className="px-2 py-1.5 font-mono text-muted">
                        {r.model.replace("claude-", "")}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.input_tokens} / {r.output_tokens}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        ${Number(r.cost_usd).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted">
              No AI calls logged yet. Try the Import button on /clients or run
              an{" "}
              <Link
                href="/admin/diagnostics"
                className="underline hover:no-underline"
              >
                AI diagnostics scan
              </Link>
              .
            </p>
          )}
        </CardBody>
      </Card>

      <AuditListClient rows={entries ?? []} actors={actors ?? []} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <Link
            href={`/admin/audit?page=${Math.max(0, page - 1)}`}
            aria-disabled={page === 0}
            className={`px-3 py-1 rounded border ${
              page === 0
                ? "border-border-soft text-muted pointer-events-none opacity-50"
                : "border-border-soft hover:bg-canvas"
            }`}
          >
            Previous
          </Link>
          <span className="text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <Link
            href={`/admin/audit?page=${page + 1}`}
            aria-disabled={page + 1 >= totalPages}
            className={`px-3 py-1 rounded border ${
              page + 1 >= totalPages
                ? "border-border-soft text-muted pointer-events-none opacity-50"
                : "border-border-soft hover:bg-canvas"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-soft bg-canvas px-3 py-2">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="font-mono text-sm font-medium">{value}</div>
    </div>
  );
}
