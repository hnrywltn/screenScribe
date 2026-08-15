"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GrantTokensForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSubmitting(true);

    const formData = new FormData(form);
    const tokens = Number(formData.get("tokens"));

    const res = await fetch("/api/admin/grant-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tokens }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed.");
      setSubmitting(false);
      return;
    }

    form.reset();
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        type="number"
        name="tokens"
        min={1}
        placeholder="tokens"
        required
        className="w-20 px-2 py-1 rounded-md border border-[var(--color-border)] bg-white text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent-hover)]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {submitting ? "…" : "Grant"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
