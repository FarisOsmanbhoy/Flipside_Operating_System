"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

const ProfileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().min(1, "Required.").max(120),
  phone: z.string().max(50).optional().or(z.literal("")),
  mobile: z.string().max(50).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  department_id: z.uuid().optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "editor"]).optional(),
});

export type ProfileState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

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
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const isSelf = parsed.data.id === profile.id;
  const isAdmin = profile.role === "admin";
  if (!isSelf && !isAdmin) return { error: "Not allowed." };

  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    mobile: parsed.data.mobile || null,
  };
  if (isAdmin) {
    payload.start_date = parsed.data.start_date || null;
    payload.department_id = parsed.data.department_id || null;
    if (parsed.data.role && !isSelf) payload.role = parsed.data.role;
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
