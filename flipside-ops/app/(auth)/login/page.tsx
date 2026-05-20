import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;

  const errorCopy =
    error === "no_profile"
      ? "Your account exists but no FlipSide profile is linked yet. Ask an admin to invite you."
      : error === "inactive"
        ? "This account has been deactivated. Contact an admin."
        : undefined;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-center mb-1 text-brand-700">
        Sign in
      </h1>
      <p className="text-sm text-muted text-center mb-5">
        Use your FlipSide email to continue.
      </p>
      {errorCopy && (
        <div className="text-sm text-danger-700 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2 mb-4">
          {errorCopy}
        </div>
      )}
      <LoginForm redirectTo={redirectTo} />
    </>
  );
}
