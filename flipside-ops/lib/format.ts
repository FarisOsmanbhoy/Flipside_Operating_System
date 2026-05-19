import { formatDistanceToNowStrict, format, differenceInDays } from "date-fns";

export function timeAgo(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function shortDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return format(d, "d MMM yyyy");
}

export type Freshness = "fresh" | "stale-soon" | "stale";

/**
 * Per spec §14 + Open Decision #3: red = stale (60+ days unreviewed).
 *   < 30d  → fresh   (neutral)
 *   30–60d → stale-soon (amber)
 *   ≥ 60d  → stale   (red)
 */
export function freshness(
  iso: string | Date | null | undefined,
): Freshness {
  if (!iso) return "stale";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const days = differenceInDays(new Date(), d);
  if (days >= 60) return "stale";
  if (days >= 30) return "stale-soon";
  return "fresh";
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
