"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { BREADCRUMB_LABELS, GROUP_FOR_PATH } from "./nav-items";

function labelFor(segment: string, fullPath: string) {
  if (BREADCRUMB_LABELS[fullPath]) return BREADCRUMB_LABELS[fullPath];
  if (BREADCRUMB_LABELS[`/${segment}`]) return BREADCRUMB_LABELS[`/${segment}`];
  // Likely a UUID/numeric id segment — show truncated form.
  if (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)) {
    return segment.length > 10 ? `${segment.slice(0, 6)}…` : segment;
  }
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const path = usePathname();
  if (path === "/") return null;

  const segments = path.split("/").filter(Boolean);
  const groupName = GROUP_FOR_PATH.find((g) => g.match.test(path))?.group;

  const crumbs: { label: string; href: string | null }[] = [
    { label: "Home", href: "/" },
  ];
  if (groupName) {
    crumbs.push({ label: groupName, href: null });
  }
  segments.forEach((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    crumbs.push({ label: labelFor(seg, href), href: isLast ? null : href });
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted"
    >
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-border-soft" />}
          {c.href ? (
            <Link href={c.href} className="hover:text-brand-700">
              {c.label}
            </Link>
          ) : (
            <span className="text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
