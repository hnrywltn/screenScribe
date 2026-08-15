export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import AutoRefresh from "@/components/AutoRefresh";
import ExtendSessionButton from "@/components/ExtendSessionButton";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing…",
  complete: "Ready to download",
  downloaded: "Downloaded",
  expired: "Expired",
  failed: "Failed",
};

export default async function SessionsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login"); // (app)/layout.tsx already gates this — defensive

  const { rows: sessions } = await pool.query(
    `SELECT id, original_filename, status, created_at, expires_at, extended FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <AutoRefresh />
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sessions</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">
        Your upload queue. Downloads stay available for 1 hour after processing finishes, then they&apos;re gone for
        good.
      </p>

      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] mt-4">No sessions yet — upload a recording to get started.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-[var(--color-border)] px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text)] truncate">{s.original_filename}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {new Date(s.created_at).toLocaleString()}
                  {s.status === "complete" && s.expires_at && (
                    <> · Ready — download by {new Date(s.expires_at).toLocaleTimeString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                {s.status === "complete" && !s.extended && <ExtendSessionButton sessionId={s.id} />}
                {s.status === "complete" && (
                  <a
                    href={`/api/sessions/${s.id}/download`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
