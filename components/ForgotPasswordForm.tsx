"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent-hover)] transition-colors";

export default function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    // Uncontrolled + FormData-at-submit, same pattern as LoginForm/
    // SignupForm — not because this field is known to be autofilled,
    // but to stay consistent with the established fix for that bug
    // rather than reintroducing a controlled input elsewhere.
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Always shows the same success state regardless of whether the
    // email exists — the API itself always returns {ok:true} for the
    // same reason.
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-[var(--color-text)]">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <Link href="/login" className="text-[var(--color-text)] underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-[var(--color-text)] mb-1">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-sm text-[var(--color-muted)] text-center">
        <Link href="/login" className="text-[var(--color-text)] underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
