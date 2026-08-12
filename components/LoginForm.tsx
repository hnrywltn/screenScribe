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
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

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
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-[var(--color-text)] mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
