"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserlessSupabase } from "@supabase/supabase-js";
import { getSession, isAdmin } from "@/lib/auth";

const ProfileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().min(1, "Required.").max(120),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  mobile: z.string().max(50).optional().or(z.literal("")),
  extension: z.string().max(20).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  department_id: z.uuid().optional().or(z.literal("")),
  job_title: z.string().max(120).optional().or(z.literal("")),
  car_registration: z.string().max(20).optional().or(z.literal("")),
  specialisation: z.string().max(200).optional().or(z.literal("")),
  languages: z.string().max(200).optional().or(z.literal("")),
  access_level: z.coerce.number().int().min(1).max(3).optional(),
});

export type ProfileState =
  | {
      success?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    }
  | undefined;

function emptyToNull(v: string | undefined | null): string | null {
  return v && v.trim() !== "" ? v : null;
}

function parseLanguages(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const profile = await getSession();
  const parsed = ProfileSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    mobile: formData.get("mobile"),
    extension: formData.get("extension"),
    date_of_birth: formData.get("date_of_birth"),
    start_date: formData.get("start_date"),
    department_id: formData.get("department_id"),
    job_title: formData.get("job_title"),
    car_registration: formData.get("car_registration"),
    specialisation: formData.get("specialisation"),
    languages: formData.get("languages"),
    access_level: formData.get("access_level") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const isSelf = parsed.data.id === profile.id;
  const actorIsAdmin = isAdmin(profile);
  if (!isSelf && !actorIsAdmin) return { error: "Not allowed." };

  // Self-editable fields. Anything else only an admin may change.
  const payload: Record<string, unknown> = {
    full_name: parsed.data.full_name,
    mobile: emptyToNull(parsed.data.mobile),
  };

  if (actorIsAdmin) {
    payload.phone = emptyToNull(parsed.data.phone);
    payload.extension = emptyToNull(parsed.data.extension);
    payload.date_of_birth = emptyToNull(parsed.data.date_of_birth);
    payload.start_date = emptyToNull(parsed.data.start_date);
    payload.department_id = emptyToNull(parsed.data.department_id);
    payload.job_title = emptyToNull(parsed.data.job_title);
    payload.car_registration = emptyToNull(parsed.data.car_registration);
    payload.specialisation = emptyToNull(parsed.data.specialisation);
    payload.languages = parseLanguages(parsed.data.languages);
    if (parsed.data.access_level && !isSelf)
      payload.access_level = parsed.data.access_level;

    if (parsed.data.email && parsed.data.email !== "") {
      payload.email = parsed.data.email;
    }
  }

  const supabase = await createClient();

  // If an admin changed the email, also update auth.users via the admin API so
  // the user can keep signing in. Profile row is updated below in the same
  // request.
  if (actorIsAdmin && typeof payload.email === "string") {
    const admin = createBrowserlessSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error: authErr } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      { email: payload.email as string, email_confirm: true },
    );
    if (authErr) return { error: authErr.message };
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

export async function setAvatarUrl(input: {
  id: string;
  avatar_url: string | null;
}): Promise<void> {
  const profile = await getSession();
  const isSelf = input.id === profile.id;
  if (!isSelf && !isAdmin(profile)) throw new Error("Not allowed.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: input.avatar_url })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/staff");
  revalidatePath(`/staff/${input.id}`);
  revalidatePath("/me");
  revalidatePath("/admin/users");
}
