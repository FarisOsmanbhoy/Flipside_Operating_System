"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Menu, Plus, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { AccessLevel } from "@/lib/access";
import { visibleGroups, visibleItems, GROUP_FOR_PATH } from "./nav-items";

export function MainNav({ level }: { level: AccessLevel }) {
  const path = usePathname();
  const groups = visibleGroups(level);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open && !mobileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) {
        const trigger = triggerRefs.current[open];
        setOpen(null);
        trigger?.focus();
      } else if (mobileOpen) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, mobileOpen]);

  const activeGroup =
    GROUP_FOR_PATH.find((g) => g.match.test(path))?.group ??
    (path === "/" ? "Home" : null);

  const focusFirstItem = useCallback((label: string) => {
    const menu = menuRefs.current[label];
    const first = menu?.querySelector<HTMLAnchorElement>("a[role='menuitem']");
    first?.focus();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="bg-surface border-b border-border-soft sticky top-14 z-20"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center md:hidden h-12">
          <button
            type="button"
            onClick={() => {
              setMobileOpen((v) => !v);
              setOpen(null);
            }}
            className="inline-flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-ink hover:bg-canvas"
            aria-expanded={mobileOpen}
            aria-controls="main-nav-mobile"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            <span>{activeGroup ?? "Menu"}</span>
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-1 flex-wrap">
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

            const items = visibleItems(g, level);
            return (
              <div key={g.label} className="relative">
                <button
                  ref={(el) => {
                    triggerRefs.current[g.label] = el;
                  }}
                  type="button"
                  onClick={() =>
                    setOpen((cur) => (cur === g.label ? null : g.label))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpen(g.label);
                      requestAnimationFrame(() => focusFirstItem(g.label));
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                    isOpen
                      ? "border-surface bg-surface text-brand-700 font-medium relative z-30"
                      : isActive
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
                    ref={(el) => {
                      menuRefs.current[g.label] = el;
                    }}
                    role="menu"
                    aria-label={g.label}
                    className="absolute left-0 top-full w-64 bg-surface border border-border-soft border-t-0 rounded-b-[var(--radius-card)] shadow-[var(--shadow-elevated)] overflow-hidden z-30"
                  >
                    {items.map((it) => {
                      const itemActive =
                        it.href === path || path.startsWith(`${it.href}/`);
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          role="menuitem"
                          onClick={() => setOpen(null)}
                          className={cn(
                            "flex items-center justify-between gap-2 px-4 py-2.5 text-sm",
                            itemActive
                              ? "bg-brand-50 text-brand-700 font-medium"
                              : "text-ink hover:bg-canvas",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <ChevronRight
                              size={14}
                              className="text-accent-500 shrink-0"
                            />
                            {it.label}
                          </span>
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

          <Link
            href="/tasks/new?type=notice"
            className="ml-auto my-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <Plus size={14} />
            New notice
          </Link>
        </nav>

        {mobileOpen && (
          <div
            id="main-nav-mobile"
            className="md:hidden py-2 border-t border-border-soft"
          >
            {groups.map((g) => {
              const Icon = g.icon;
              const isActive = g.label === activeGroup;
              const items = g.items ? visibleItems(g, level) : [];

              if (!items.length && g.href) {
                return (
                  <Link
                    key={g.label}
                    href={g.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 text-sm rounded-md",
                      isActive
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-ink hover:bg-canvas",
                    )}
                  >
                    <Icon size={16} />
                    {g.label}
                  </Link>
                );
              }

              return (
                <div key={g.label} className="py-1">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
                    <Icon size={14} />
                    {g.label}
                  </div>
                  <div className="flex flex-col">
                    {items.map((it) => {
                      const itemActive =
                        it.href === path || path.startsWith(`${it.href}/`);
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 pl-9 pr-3 py-2 text-sm rounded-md",
                            itemActive
                              ? "bg-brand-50 text-brand-700 font-medium"
                              : "text-ink hover:bg-canvas",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <ChevronRight
                              size={14}
                              className="text-accent-500 shrink-0"
                            />
                            {it.label}
                          </span>
                          {it.stub && (
                            <span className="text-[10px] uppercase tracking-wide text-muted">
                              soon
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
