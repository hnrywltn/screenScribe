"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelSubscriptionButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not cancel.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setConfirming(false);
    setTimeout(() => router.refresh(), 1200);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted)]">Cancel at period end?</span>
        <button
          onClick={handleCancel}
          disabled={submitting}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? "…" : "Yes, cancel"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="px-2.5 py-1 rounded-md text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Never mind
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-[var(--color-muted)] hover:text-red-600 transition-colors underline"
    >
      Cancel subscription
    </button>
  );
}
