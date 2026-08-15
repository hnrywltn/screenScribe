import ResetPasswordForm from "@/components/ResetPasswordForm";

// Deliberately no "redirect if already logged in" guard, same reasoning
// as forgot-password/page.tsx.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-8">Reset your password</h1>
      <ResetPasswordForm token={token ?? ""} />
    </div>
  );
}
