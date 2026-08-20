"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent-hover)] transition-colors";

export default function AccountForm({
  initialPhone,
  initialSmsOptIn,
}: {
  initialPhone: string;
  initialSmsOptIn: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Uncontrolled, read via FormData at submit time — same
  // autofill-safety pattern as SignupForm.tsx/LoginForm.tsx.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const phone = String(formData.get("phone") ?? "");
    const smsOptIn = formData.get("smsOptIn") === "on";

    const res = await fetch("/api/account/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, smsOptIn }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm text-[var(--color-text)] mb-1">
          Phone number <span className="text-[var(--color-muted)] font-normal">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={initialPhone} className={inputClass} />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="smsOptIn"
          name="smsOptIn"
          type="checkbox"
          defaultChecked={initialSmsOptIn}
          className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)]"
        />
        <label htmlFor="smsOptIn" className="text-xs text-[var(--color-muted)] leading-relaxed">
          Yes, text me at the number above when my upload starts processing and when it&apos;s ready to download. Up
          to 2 messages per video. Message and data rates may apply. Reply HELP for help, STOP to cancel anytime.
          See our{" "}
          <Link href="/terms" className="underline hover:text-[var(--color-text)]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-[var(--color-text)]">
            Privacy Policy
          </Link>
          .
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
