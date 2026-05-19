"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/auth";
import { visibleGroups, visibleItems, GROUP_FOR_PATH } from "./nav-items";

export function MainNav({ role }: { role: Role }) {
  const path = usePathname();
  const groups = visibleGroups(role);
  const [open, setOpen] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeGroup =
    GROUP_FOR_PATH.find((g) => g.match.test(path))?.group ??
    (path === "/" ? "Home" : null);

  return (
    <div
      ref={wrapRef}
      className="bg-surface border-b border-border-soft sticky top-14 z-20"
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
        {groups.map((g) => {
          const Icon = g.icon;
          const isActive = g.label === activeGroup;
          const hasDropdown = !!g.items?.length;
          const isOpen = open === g.label;

          if (!hasDropdown && g.href) {
            return (
              <Link
                key={g.label}
                href={g.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand-500 text-brand-700 font-medium"
                    : "border-transparent text-muted hover:text-ink hover:bg-canvas",
                )}
              >
                <Icon size={16} />
                {g.label}
              </Link>
            );
          }

          const items = visibleItems(g, role);
          return (
            <div
              key={g.label}
              className="relative"
              onMouseEnter={() => setOpen(g.label)}
              onMouseLeave={() => setOpen((cur) => (cur === g.label ? null : cur))}
            >
              <button
                type="button"
                onClick={() => setOpen((cur) => (cur === g.label ? null : g.label))}
                className={cn(
                  "flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand-500 text-brand-700 font-medium"
                    : "border-transparent text-muted hover:text-ink hover:bg-canvas",
                )}
                aria-haspopup="menu"
                aria-expanded={isOpen}
              >
                <Icon size={16} />
                {g.label}
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform",
                    isOpen ? "rotate-180" : "",
                  )}
                />
              </button>

              {isOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-0 w-64 bg-surface border border-border-soft rounded-b-[var(--radius-card)] shadow-lg overflow-hidden z-30"
                >
                  {items.map((it) => {
                    const itemActive =
                      it.href === path || path.startsWith(`${it.href}/`);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setOpen(null)}
                        className={cn(
                          "flex items-center justify-between gap-2 px-4 py-2.5 text-sm",
                          itemActive
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-ink hover:bg-canvas",
                        )}
                      >
                        <span>{it.label}</span>
                        {it.stub && (
                          <span className="text-[10px] uppercase tracking-wide text-muted">
                            soon
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
