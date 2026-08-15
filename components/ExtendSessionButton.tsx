"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExtendSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/sessions/${sessionId}/extend`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't extend.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleClick}
        disabled={submitting}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-60"
      >
        {submitting ? "…" : "Extend (+50 tokens)"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
