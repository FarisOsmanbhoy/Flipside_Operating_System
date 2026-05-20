// Browser-safe access-level primitives. Lives outside lib/auth.ts so it can be
// imported from both server modules and client components without dragging in
// the "server-only" boundary.

export type AccessLevel = 1 | 2 | 3;

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string | null;
  access_level: AccessLevel;
  department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  3: "Admin",
  2: "Manager",
  1: "Editor",
};

type Levelled = { access_level: number };

export const isAdmin = (p: Levelled) => p.access_level >= 3;
export const canManage = (p: Levelled) => p.access_level >= 2;
export const hasLevel = (p: Levelled, min: AccessLevel) =>
  p.access_level >= min;
