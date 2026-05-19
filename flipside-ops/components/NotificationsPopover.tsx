"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckSquare, AlertCircle, MessageSquare } from "lucide-react";
import { cn, timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/notifications";

const LAST_SEEN_KEY = "flipside.notifications.last_seen";

const ICONS: Record<Notification["kind"], typeof Bell> = {
  task_due: CheckSquare,
  task_overdue: AlertCircle,
  change_request_decision: MessageSquare,
};

export function NotificationsPopover() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem(LAST_SEEN_KEY) ?? "0");
    setLastSeen(stored);
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = (await res.json()) as { notifications: Notification[] };
      setItems(json.notifications);
    } catch {
      // network error — silent
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unreadCount = items.filter(
    (n) => new Date(n.created_at).getTime() > lastSeen,
  ).length;

  const handleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        const now = Date.now();
        localStorage.setItem(LAST_SEEN_KEY, String(now));
        setLastSeen(now);
      }
      return next;
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-muted hover:bg-canvas hover:text-ink"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-danger-500 text-[10px] font-medium text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-lg overflow-hidden z-40">
          <div className="px-4 py-2 border-b border-border-soft text-xs font-medium text-muted">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              All caught up.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.slice(0, 8).map((n) => {
                const Icon = ICONS[n.kind];
                const overdue = n.kind === "task_overdue";
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-canvas"
                    >
                      <Icon
                        size={16}
                        className={cn(
                          "mt-0.5 shrink-0",
                          overdue ? "text-danger-500" : "text-muted",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-ink truncate">{n.title}</div>
                        <div className="text-xs text-muted">
                          {n.subtitle} · {timeAgo(n.created_at)}
                        </div>
                      </div>
                    </Link>
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
