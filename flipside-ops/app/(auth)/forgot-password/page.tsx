import { ForgotForm } from "./ForgotForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-center mb-1 text-brand-700">
        Reset your password
      </h1>
      <p className="text-sm text-muted text-center mb-5">
        We&apos;ll send you a link to set a new one.
      </p>
      <ForgotForm />
    </>
  );
}
