import ForgotPasswordForm from "@/components/ForgotPasswordForm";

// Deliberately no "redirect if already logged in" guard, unlike
// login/signup — a user logged in on one device can legitimately still
// need to reset a password saved (or forgotten) elsewhere.
export default function ForgotPasswordPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-2">Reset your password</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8 text-center max-w-sm">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
