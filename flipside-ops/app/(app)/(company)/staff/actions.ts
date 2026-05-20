"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";

const ProfileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().min(1, "Required.").max(120),
  phone: z.string().max(50).optional().or(z.literal("")),
  mobile: z.string().max(50).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  department_id: z.uuid().optional().or(z.literal("")),
  access_level: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .optional(),
});

export type ProfileState =
  | {
      success?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    }
  | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const profile = await getSession();
  const parsed = ProfileSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    mobile: formData.get("mobile"),
    start_date: formData.get("start_date"),
    department_id: formData.get("department_id"),
    access_level: formData.get("access_level") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const isSelf = parsed.data.id === profile.id;
  const actorIsAdmin = isAdmin(profile);
  if (!isSelf && !actorIsAdmin) return { error: "Not allowed." };

  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    mobile: parsed.data.mobile || null,
  };
  if (actorIsAdmin) {
    payload.start_date = parsed.data.start_date || null;
    payload.department_id = parsed.data.department_id || null;
    if (parsed.data.access_level && !isSelf)
      payload.access_level = parsed.data.access_level;
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath(`/staff/${parsed.data.id}`);
  revalidatePath("/staff");
  return { success: true };
}
