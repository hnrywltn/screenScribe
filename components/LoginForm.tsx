"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent-hover)] transition-colors";

// Dev convenience only. process.env.NODE_ENV is replaced at build time
// (same mechanism React itself uses to strip dev-only code), so this
// literally cannot end up prefilled in a production build — `next build`
// sets NODE_ENV to "production", collapsing this to "" before the code
// ships, not a runtime check that could be bypassed.
const isDev = process.env.NODE_ENV === "development";
const DEV_EMAIL = isDev ? "dev@screenscribe.test" : "";
const DEV_PASSWORD = isDev ? "devpassword123" : "";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Read straight from the form via FormData, not React state. These
    // fields are uncontrolled (defaultValue, no onChange) on purpose —
    // browser autofill fills the DOM value without reliably firing the
    // input event a controlled component needs to stay in sync, so a
    // controlled `email`/`password` state can silently go stale even
    // though the field visibly shows the right value. FormData always
    // reflects exactly what's currently in the form.
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      {isDev && (
        <p className="text-xs text-[var(--color-muted)] bg-[var(--color-accent)]/30 border border-[var(--color-border)] rounded-lg px-3 py-2">
          Dev mode — pre-filled with the seeded dev login.
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm text-[var(--color-text)] mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={DEV_EMAIL}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-[var(--color-text)] mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue={DEV_PASSWORD}
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      <p className="text-sm text-[var(--color-muted)] text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--color-text)] underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
