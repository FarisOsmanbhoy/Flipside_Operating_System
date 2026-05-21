import {
  Home,
  Users,
  ClipboardList,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { AccessLevel } from "@/lib/access";

export type NavLeaf = {
  label: string;
  href: string;
  minLevel?: AccessLevel;
  stub?: boolean;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: NavLeaf[];
  minLevel?: AccessLevel;
};

export const NAV: NavGroup[] = [
  { label: "Home", icon: Home, href: "/" },
  {
    label: "Company",
    icon: Users,
    items: [
      { label: "Staff", href: "/staff" },
      { label: "My Profile", href: "/me" },
      { label: "Company Profile", href: "/company/profile", stub: true },
    ],
  },
  {
    label: "Administration",
    icon: ClipboardList,
    items: [
      { label: "Tasks & Notices", href: "/tasks" },
      { label: "Passwords", href: "/passwords" },
      { label: "Manuals & Guides", href: "/manuals" },
      { label: "Audit Log", href: "/admin/audit", minLevel: 3 },
      { label: "Users", href: "/admin/users", minLevel: 3 },
      { label: "Config", href: "/admin/config", minLevel: 3 },
      { label: "Reports", href: "/admin/reports", stub: true },
      { label: "Suggestions & Feedback", href: "/admin/suggestions", stub: true },
      { label: "Training", href: "/admin/training", stub: true },
    ],
  },
  {
    label: "Operational",
    icon: Briefcase,
    items: [
      { label: "Client Data", href: "/clients" },
      { label: "Supplier Data", href: "/suppliers" },
    ],
  },
];

export function visibleItems(group: NavGroup, level: AccessLevel): NavLeaf[] {
  return (group.items ?? []).filter(
    (it) => it.minLevel === undefined || level >= it.minLevel,
  );
}

export function visibleGroups(level: AccessLevel): NavGroup[] {
  return NAV.filter((g) => {
    if (g.minLevel && level < g.minLevel) return false;
    if (!g.items) return true;
    return visibleItems(g, level).length > 0;
  });
}

export const BREADCRUMB_LABELS: Record<string, string> = {
  "/": "Home",
  "/staff": "Staff",
  "/me": "My Profile",
  "/company/profile": "Company Profile",
  "/tasks": "Tasks & Notices",
  "/tasks/new": "New",
  "/passwords": "Passwords",
  "/manuals": "Manuals & Guides",
  "/admin": "Administration",
  "/admin/audit": "Audit Log",
  "/admin/users": "Users",
  "/admin/config": "Config",
  "/admin/reports": "Reports",
  "/admin/suggestions": "Suggestions & Feedback",
  "/admin/training": "Training",
  "/clients": "Client Data",
  "/clients/new": "New Client",
  "/suppliers": "Supplier Data",
  "/suppliers/new": "New Supplier",
};

export const GROUP_FOR_PATH: { match: RegExp; group: string }[] = [
  { match: /^\/staff/, group: "Company" },
  { match: /^\/me/, group: "Company" },
  { match: /^\/company/, group: "Company" },
  { match: /^\/tasks/, group: "Administration" },
  { match: /^\/passwords/, group: "Administration" },
  { match: /^\/manuals/, group: "Administration" },
  { match: /^\/admin/, group: "Administration" },
  { match: /^\/clients/, group: "Operational" },
  { match: /^\/suppliers/, group: "Operational" },
];
