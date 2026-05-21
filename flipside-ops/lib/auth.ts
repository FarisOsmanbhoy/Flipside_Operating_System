import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccessLevel, SessionProfile } from "@/lib/access";

export {
  type AccessLevel,
  type SessionProfile,
  LEVEL_LABELS,
  levelLabel,
  isAdmin,
  canManage,
  hasLevel,
} from "@/lib/access";

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
      "id, email, full_name, access_level, department_id, avatar_url, is_active",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=no_profile");
  if (!profile.is_active) redirect("/login?error=inactive");

  return profile as SessionProfile;
});

export async function requireLevel(min: AccessLevel): Promise<SessionProfile> {
  const profile = await getSession();
  if (profile.access_level < min) redirect("/?error=forbidden");
  return profile;
}
