import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const userId = await getCurrentUserId();
  if (userId) redirect("/dashboard");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-8">Log in</h1>
      <LoginForm />
    </div>
  );
}
