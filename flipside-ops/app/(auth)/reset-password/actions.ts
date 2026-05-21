"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const Schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    error: "Passwords don't match.",
  });

export type ResetState = {
  error?: string;
  fieldErrors?: { password?: string[]; confirm?: string[] };
} | undefined;

export async function updatePassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = Schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data: updated, error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  if (updated.user) {
    await supabase
      .from("profiles")
      .update({
        password_set_at: new Date().toISOString(),
        password_set_by: null,
        must_change_password: false,
      })
      .eq("id", updated.user.id);
  }

  redirect("/?password=updated");
}
