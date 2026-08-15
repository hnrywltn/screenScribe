"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  revoked: "Revoked",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-amber-500",
  revoked: "bg-red-500",
};

export default function AccountStatusControl({
  userId,
  currentStatus,
  disabled = false,
}: {
  userId: string;
  currentStatus: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value;
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin/set-account-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[currentStatus] ?? "bg-[var(--color-muted)]"}`} />
        {STATUS_LABEL[currentStatus] ?? currentStatus}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[currentStatus] ?? "bg-[var(--color-muted)]"}`} />
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={submitting}
        className="px-2 py-1 rounded-md border border-[var(--color-border)] bg-white text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent-hover)] disabled:opacity-60"
      >
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="revoked">Revoked</option>
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
