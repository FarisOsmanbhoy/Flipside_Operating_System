import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await getSession();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: statuses }, { data: pms }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, name, location, important_info, updated_at, status_id, assigned_pm_id",
        )
        .order("name"),
      supabase
        .from("client_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);

  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s.name]));
  const pmMap = new Map((pms ?? []).map((p) => [p.id, p]));

  const filtered = (clients ?? []).filter((c) => {
    if (status && c.status_id !== status) return false;
    if (q) {
      const needle = q.toLowerCase();
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.important_info ?? "").toLowerCase().includes(needle) ||
        (c.location ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const canCreate = ["admin", "manager"].includes(profile.role);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} of ${clients?.length ?? 0}`}
        actions={
          canCreate ? (
            <Link href="/clients/new">
              <Button>
                <Plus size={16} />
                New client
              </Button>
            </Link>
          ) : undefined
        }
      />

      <form className="flex flex-col sm:flex-row gap-3 mb-4" action="/clients">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search clients…"
          className="flex-1 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="sm:w-56 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          {(statuses ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients yet"
            description={
              canCreate
                ? "Add the first client to start building your knowledge base."
                : "An admin or manager will set these up."
            }
            action={
              canCreate ? (
                <Link href="/clients/new">
                  <Button>New client</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const pm = c.assigned_pm_id ? pmMap.get(c.assigned_pm_id) : null;
            const statusName = c.status_id ? statusMap.get(c.status_id) : null;
            return (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <Card className="h-full hover:border-brand-500 transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-ink">{c.name}</h3>
                      {statusName && (
                        <Pill
                          tone={
                            statusName === "Active"
                              ? "success"
                              : statusName === "Closed"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {statusName}
                        </Pill>
                      )}
                    </div>
                    {c.location && (
                      <p className="text-sm text-muted flex items-center gap-1 mb-3">
                        <MapPin size={12} /> {c.location}
                      </p>
                    )}
                    {c.important_info && (
                      <p className="text-sm text-ink/80 line-clamp-2 mb-3">
                        {c.important_info}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border-soft">
                      <div className="flex items-center gap-2">
                        {pm ? (
                          <>
                            <Avatar
                              name={pm.full_name}
                              src={pm.avatar_url}
                              size={20}
                            />
                            <span className="truncate">
                              {pm.full_name ?? "—"}
                            </span>
                          </>
                        ) : (
                          <span className="italic">No PM assigned</span>
                        )}
                      </div>
                      <span>Updated {timeAgo(c.updated_at)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
