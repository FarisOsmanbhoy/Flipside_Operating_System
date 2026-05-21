import { ForgotForm } from "./ForgotForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const expired = error === "expired_link";

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-center mb-1 text-brand-700">
        Reset your password
      </h1>
      <p className="text-sm text-muted text-center mb-5">
        We&apos;ll send you a link to set a new one.
      </p>
      {expired && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2 mb-4">
          That reset link has expired or already been used. Request a fresh one
          below.
        </div>
      )}
      <ForgotForm />
    </>
  );
}
