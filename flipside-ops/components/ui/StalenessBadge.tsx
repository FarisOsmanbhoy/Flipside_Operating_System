import { freshness, timeAgo } from "@/lib/format";
import { Pill } from "./Pill";

export function StalenessBadge({
  date,
}: {
  date: string | Date | null | undefined;
}) {
  const state = freshness(date);
  const tone =
    state === "stale" ? "danger" : state === "stale-soon" ? "warning" : "neutral";
  const label =
    state === "stale"
      ? `Stale — reviewed ${timeAgo(date)}`
      : state === "stale-soon"
        ? `Review soon — ${timeAgo(date)}`
        : `Updated ${timeAgo(date)}`;
  return <Pill tone={tone}>{label}</Pill>;
}
