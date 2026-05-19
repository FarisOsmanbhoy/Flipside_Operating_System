"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Briefcase, CheckSquare, User } from "lucide-react";
import { cn } from "@/lib/format";
import type { SearchHit } from "@/app/api/search/route";

const ROUTES: Record<SearchHit["kind"], string> = {
  client: "/clients",
  task: "/tasks",
  staff: "/staff",
};

const ICONS: Record<SearchHit["kind"], typeof Briefcase> = {
  client: Briefcase,
  task: CheckSquare,
  staff: User,
};

export function UniversalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { hits: SearchHit[] };
        setHits(json.hits);
        setActive(0);
      } catch {
        // aborted
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    router.push(`${ROUTES[hit.kind]}/${hit.id}`);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-sm">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            go(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search clients, tasks, staff…  (Ctrl+K)"
        className="h-9 w-full rounded-lg border border-border-soft bg-canvas pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        aria-label="Universal search"
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-lg overflow-hidden z-40">
          {hits.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted">No matches.</div>
          ) : (
            <ul role="listbox">
              {hits.map((hit, i) => {
                const Icon = ICONS[hit.kind];
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => go(hit)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm text-left",
                        i === active ? "bg-brand-50" : "hover:bg-canvas",
                      )}
                    >
                      <Icon size={14} className="text-muted shrink-0" />
                      <span className="flex-1 truncate">
                        <span className="text-ink">{hit.label}</span>
                        {hit.sublabel && (
                          <span className="ml-2 text-xs text-muted">
                            {hit.sublabel}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted capitalize">
                        {hit.kind}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
