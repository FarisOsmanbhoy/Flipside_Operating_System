import Link from "next/link";
import { Megaphone } from "lucide-react";
import { timeAgo } from "@/lib/format";

export function AlertRibbon({
  notice,
}: {
  notice: { id: string; title: string; created_at: string } | null;
}) {
  if (!notice) return null;
  return (
    <Link
      href={`/tasks/${notice.id}`}
      className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-[var(--radius-card)] bg-accent-50 border border-accent-100 hover:bg-accent-100 transition-colors"
    >
      <Megaphone size={16} className="text-accent-700 shrink-0" />
      <span className="text-sm font-medium text-ink truncate flex-1">
        {notice.title}
      </span>
      <span className="text-xs text-muted whitespace-nowrap">
        {timeAgo(notice.created_at)}
      </span>
    </Link>
  );
}
