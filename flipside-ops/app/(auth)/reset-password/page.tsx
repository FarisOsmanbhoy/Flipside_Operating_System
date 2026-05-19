import { ResetForm } from "./ResetForm";

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-center mb-1">
        Choose a new password
      </h1>
      <p className="text-sm text-muted text-center mb-5">
        At least 8 characters. Mix letters and numbers.
      </p>
      <ResetForm />
    </>
  );
}
