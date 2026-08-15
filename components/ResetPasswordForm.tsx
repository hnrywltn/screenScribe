"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent-hover)] transition-colors";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/login?reset=success");
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-red-600">This reset link is missing its token.</p>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <Link href="/forgot-password" className="text-[var(--color-text)] underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="newPassword" className="block text-sm text-[var(--color-text)] mb-1">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm text-[var(--color-text)] mb-1">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
