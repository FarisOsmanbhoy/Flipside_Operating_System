"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/format";

type Status = { id: string; name: string };

export function ClientsFilters({
  statuses,
  initialQ,
  initialStatus,
  canEdit,
}: {
  statuses: Status[];
  initialQ?: string;
  initialStatus?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`/clients?${next.toString()}`));
  };

  const clear = () => start(() => router.replace(`/clients`));

  return (
    <div className="space-y-5">
      {canEdit && (
        <Link href="/clients/new" className="block">
          <Button className="w-full">
            <Plus size={16} />
            New client
          </Button>
        </Link>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
          Search
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="search"
            defaultValue={initialQ ?? ""}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Name, location…"
            className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
          Filter by status
        </label>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => update("status", "")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left",
                !initialStatus
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-ink hover:bg-canvas",
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  !initialStatus ? "bg-brand-500" : "bg-border-soft",
                )}
              />
              All statuses
            </button>
          </li>
          {statuses.map((s) => {
            const active = initialStatus === s.id;
            const tone =
              s.name.toLowerCase() === "active"
                ? "bg-emerald-500"
                : s.name.toLowerCase() === "closed"
                  ? "bg-gray-400"
                  : "bg-amber-500";
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => update("status", s.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left",
                    active
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-ink hover:bg-canvas",
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      active ? tone : "bg-border-soft",
                    )}
                  />
                  {s.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {(initialQ || initialStatus) && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-xs text-danger-700 hover:underline"
        >
          <XCircle size={12} /> Clear filter
        </button>
      )}
    </div>
  );
}
