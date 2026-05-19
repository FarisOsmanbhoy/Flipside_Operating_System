"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/Input";

export function StaffFilters({
  departments,
  initialQ,
  initialDept,
}: {
  departments: { id: string; name: string }[];
  initialQ?: string;
  initialDept?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`/staff?${next.toString()}`));
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="search"
          defaultValue={initialQ ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search by name or email…"
          className="block w-full rounded-lg border border-border-soft bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <Select
        defaultValue={initialDept ?? ""}
        onChange={(e) => update("dept", e.target.value)}
        className="sm:w-56"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
