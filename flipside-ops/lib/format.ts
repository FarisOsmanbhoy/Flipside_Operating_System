import { formatDistanceToNowStrict, format, differenceInDays } from "date-fns";

function toValidDate(iso: string | Date | null | undefined): Date | null {
  if (iso == null || iso === "") return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Comma-separated display for profiles.languages (text[] or legacy string). */
export function formatLanguageList(value: unknown): string {
  return normalizeLanguages(value).join(", ");
}

export function normalizeLanguages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function timeAgo(iso: string | Date | null | undefined) {
  const d = toValidDate(iso);
  if (!d) return "—";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function shortDate(iso: string | Date | null | undefined) {
  const d = toValidDate(iso);
  if (!d) return "—";
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
  const d = toValidDate(iso);
  if (!d) return "stale";
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
