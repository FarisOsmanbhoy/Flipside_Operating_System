import {
  Home,
  Users,
  ClipboardList,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export type NavLeaf = {
  label: string;
  href: string;
  roles?: Role[];
  stub?: boolean;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: NavLeaf[];
  roles?: Role[];
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
      { label: "Audit Log", href: "/admin/audit", roles: ["admin"] },
      { label: "Users", href: "/admin/users", roles: ["admin"] },
      { label: "Config", href: "/admin/config", roles: ["admin"] },
      { label: "Reports", href: "/admin/reports", stub: true },
      { label: "Suggestions & Feedback", href: "/admin/suggestions", stub: true },
      { label: "Training", href: "/admin/training", stub: true },
    ],
  },
  {
    label: "Operational",
    icon: Briefcase,
    items: [
      { label: "Clients", href: "/clients" },
      { label: "Change Requests", href: "/clients/changes" },
      { label: "New Client", href: "/clients/new", roles: ["admin", "manager"] },
    ],
  },
];

export function visibleItems(group: NavGroup, role: Role): NavLeaf[] {
  return (group.items ?? []).filter((it) => !it.roles || it.roles.includes(role));
}

export function visibleGroups(role: Role): NavGroup[] {
  return NAV.filter((g) => {
    if (g.roles && !g.roles.includes(role)) return false;
    if (!g.items) return true;
    return visibleItems(g, role).length > 0;
  });
}

export const BREADCRUMB_LABELS: Record<string, string> = {
  "/": "Home",
  "/staff": "Staff",
  "/me": "My Profile",
  "/company/profile": "Company Profile",
  "/tasks": "Tasks & Notices",
  "/tasks/new": "New",
  "/admin": "Administration",
  "/admin/audit": "Audit Log",
  "/admin/users": "Users",
  "/admin/config": "Config",
  "/admin/reports": "Reports",
  "/admin/suggestions": "Suggestions & Feedback",
  "/admin/training": "Training",
  "/clients": "Clients",
  "/clients/new": "New Client",
  "/clients/changes": "Change Requests",
};

export const GROUP_FOR_PATH: { match: RegExp; group: string }[] = [
  { match: /^\/staff/, group: "Company" },
  { match: /^\/me/, group: "Company" },
  { match: /^\/company/, group: "Company" },
  { match: /^\/tasks/, group: "Administration" },
  { match: /^\/admin/, group: "Administration" },
  { match: /^\/clients/, group: "Operational" },
];
