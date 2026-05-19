"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Briefcase, CheckSquare, User, X } from "lucide-react";
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

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
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
  }, [q, open]);

  if (!open) return null;

  const go = (hit: SearchHit) => {
    onOpenChange(false);
    router.push(`${ROUTES[hit.kind]}/${hit.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-xl bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-border-soft">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
              }
            }}
            placeholder="Search clients, tasks, staff…"
            className="flex-1 h-12 bg-transparent text-sm focus:outline-none placeholder:text-muted"
            aria-label="Universal search"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 text-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              Start typing to search.
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              No matches.
            </div>
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
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left",
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
      </div>
    </div>
  );
}
