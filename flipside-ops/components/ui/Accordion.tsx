"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

export function Accordion({
  title,
  defaultOpen = false,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface border border-border-soft rounded-[var(--radius-card)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          aria-expanded={open}
        >
          <ChevronDown
            size={16}
            className={cn("text-muted transition-transform", open && "rotate-180")}
          />
          <span className="font-semibold text-ink truncate">{title}</span>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {meta}
          {actions}
        </div>
      </div>
      {open && (
        <div className="border-t border-border-soft px-5 py-4">{children}</div>
      )}
    </div>
  );
}
