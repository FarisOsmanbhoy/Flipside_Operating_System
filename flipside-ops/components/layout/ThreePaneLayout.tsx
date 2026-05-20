"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/format";

type Props = {
  filters: ReactNode;
  children: ReactNode;
  context?: ReactNode;
  contextOpen?: boolean;
  onContextOpenChange?: (open: boolean) => void;
  contextTitle?: string;
};

export function ThreePaneLayout({
  filters,
  children,
  context,
  contextOpen,
  onContextOpenChange,
  contextTitle,
}: Props) {
  const hasContext = context !== undefined && context !== null;
  const controlledOpen = contextOpen ?? false;

  useEffect(() => {
    if (!controlledOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onContextOpenChange?.(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [controlledOpen, onContextOpenChange]);

  return (
    <div
      className={cn(
        "fs-three-pane",
        hasContext && "fs-three-pane--with-context",
      )}
    >
      <aside className="lg:sticky lg:top-36 lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
        <Card className="p-4">{filters}</Card>
      </aside>

      <div className="min-w-0">{children}</div>

      {hasContext && (
        <>
          {/* Permanent right pane on >=xl */}
          <aside className="hidden xl:block xl:sticky xl:top-36 xl:self-start xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
            <Card className="overflow-hidden">{context}</Card>
          </aside>

          {/* Slideover for < xl */}
          <div
            className={cn(
              "xl:hidden fixed inset-0 z-40 transition-opacity duration-200",
              controlledOpen
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            )}
            aria-hidden={!controlledOpen}
          >
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => onContextOpenChange?.(false)}
              className="absolute inset-0 bg-black/30"
            />
            <div
              role="dialog"
              aria-label={contextTitle ?? "Details"}
              className={cn(
                "absolute right-0 top-0 h-full w-full sm:w-[24rem] bg-surface shadow-[var(--shadow-elevated)] transition-transform duration-200 flex flex-col",
                controlledOpen ? "translate-x-0" : "translate-x-full",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-soft">
                <span className="text-sm font-medium text-ink">
                  {contextTitle ?? "Details"}
                </span>
                <button
                  type="button"
                  onClick={() => onContextOpenChange?.(false)}
                  className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-canvas"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{context}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
