import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const userId = await getCurrentUserId();
  if (userId) redirect("/dashboard");

  const { reset } = await searchParams;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-8">Log in</h1>
      {reset === "success" && (
        <p className="mb-4 w-full max-w-sm text-sm text-[var(--color-text)] bg-[var(--color-accent)]/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5">
          Password reset — log in with your new password.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
