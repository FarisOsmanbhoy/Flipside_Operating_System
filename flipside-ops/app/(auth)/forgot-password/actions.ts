"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({ email: z.email("Enter a valid email.") });

export type ForgotState = {
  message?: string;
  error?: string;
  fieldErrors?: { email?: string[] };
} | undefined;

export async function sendResetEmail(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = Schema.safeParse({ email: formData.get("email") });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password`,
  });
  if (error) return { error: error.message };
  return { message: "If that email is registered, a reset link is on its way." };
}
