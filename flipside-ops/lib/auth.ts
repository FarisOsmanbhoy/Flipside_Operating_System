import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "manager" | "editor";

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

/**
 * Verify the user has a Supabase session and a profile row.
 * Redirects to /login if not. Memoized per request via React cache().
 */
export const getSession = cache(async (): Promise<SessionProfile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, department_id, avatar_url, is_active",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=no_profile");
  if (!profile.is_active) redirect("/login?error=inactive");

  return profile as SessionProfile;
});

export async function requireRole(
  ...allowed: Role[]
): Promise<SessionProfile> {
  const profile = await getSession();
  if (!allowed.includes(profile.role)) redirect("/?error=forbidden");
  return profile;
}

export function can(role: Role, ...allowed: Role[]) {
  return allowed.includes(role);
}
