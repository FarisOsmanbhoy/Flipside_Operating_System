"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const LoginSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
} | undefined;

export async function signInWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  const redirectTo = (formData.get("redirectTo") as string) || "/";
  redirect(redirectTo);
}

const MagicLinkSchema = z.object({ email: z.email() });

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  return { error: "Check your email for a sign-in link." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
