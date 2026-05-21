import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) redirect("/forgot-password?error=expired_link");
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-center mb-1 text-brand-700">
        Choose a new password
      </h1>
      <p className="text-sm text-muted text-center mb-5">
        At least 8 characters. Mix letters and numbers.
      </p>
      <ResetForm />
    </>
  );
}
