"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/format";

type TabKey = "task" | "notice" | "industry_alert" | "recurring_template";

const NEW_LABEL: Record<TabKey, string> = {
  task: "New task",
  notice: "New notice",
  industry_alert: "New alert",
  recurring_template: "New recurring",
};

export function TasksFilters({
  initialQ,
  initialMine,
  tab,
}: {
  initialQ?: string;
  initialMine?: string;
  tab: TabKey;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`/tasks?${next.toString()}`));
  };

  const mine = initialMine === "1";

  return (
    <div className="space-y-5">
      <Link href={`/tasks/new?type=${tab}`} className="block">
        <Button className="w-full">
          <Plus size={16} />
          {NEW_LABEL[tab]}
        </Button>
      </Link>

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
            placeholder="Title…"
            className="block w-full rounded-lg border border-border-soft bg-surface pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-muted tracking-wide mb-2">
          Assignee
        </label>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => update("mine", "")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left",
                !mine
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-ink hover:bg-canvas",
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  !mine ? "bg-brand-500" : "bg-border-soft",
                )}
              />
              All assignees
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => update("mine", "1")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1 text-sm rounded-md text-left",
                mine
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-ink hover:bg-canvas",
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  mine ? "bg-brand-500" : "bg-border-soft",
                )}
              />
              Assigned to me
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
