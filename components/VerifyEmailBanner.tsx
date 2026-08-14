"use client";

import { useState } from "react";

export default function VerifyEmailBanner() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setStatus("sending");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <div className="bg-[var(--color-accent)]/40 border-b border-[var(--color-border)] px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-text)]">Verify your email so you don&apos;t miss download-ready notifications.</span>
      <button
        onClick={resend}
        disabled={status === "sending" || status === "sent"}
        className="shrink-0 underline text-[var(--color-text)] hover:opacity-70 transition-opacity disabled:opacity-50"
      >
        {status === "sent" ? "Sent!" : status === "sending" ? "Sending…" : status === "error" ? "Failed — retry" : "Resend email"}
      </button>
    </div>
  );
}
