export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import AutoRefresh from "@/components/AutoRefresh";
import ExtendSessionButton from "@/components/ExtendSessionButton";
import ActiveUploadRow from "@/components/ActiveUploadRow";
import SessionStageProgress from "@/components/SessionStageProgress";
import SessionMeta from "@/components/SessionMeta";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing…",
  transcoding: "Transcoding…",
  detecting_scenes: "Detecting scenes…",
  transcribing: "Transcribing…",
  packaging: "Packaging…",
  complete: "Ready to download",
  downloaded: "Downloaded",
  expired: "Expired",
  failed: "Failed",
};

export default async function SessionsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login"); // (app)/layout.tsx already gates this — defensive

  // LEFT JOIN, not a subquery — at most one usage_upload grant exists
  // per session (chargeTokens() is called once per upload), so a plain
  // join can't duplicate rows here. ABS() since usage charges are stored
  // negative (see lib/tokens.ts) but the Sessions page wants to show a
  // plain "12 tokens" cost, not "-12".
  const { rows: sessions } = await pool.query(
    `SELECT s.id, s.original_filename, s.status, s.created_at, s.expires_at, s.extended,
            s.processing_started_at, s.processed_at, ABS(tg.tokens) AS cost_tokens
     FROM sessions s
     LEFT JOIN token_grants tg ON tg.session_id = s.id AND tg.source = 'usage_upload'
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
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

      <div className="mt-6 space-y-2">
        <ActiveUploadRow />

        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No sessions yet — upload a recording to get started.</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-[var(--color-border)] px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text)] truncate">{s.original_filename}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  <SessionMeta
                    createdAt={new Date(s.created_at).toISOString()}
                    status={s.status}
                    expiresAt={s.expires_at ? new Date(s.expires_at).toISOString() : null}
                    processingStartedAt={s.processing_started_at ? new Date(s.processing_started_at).toISOString() : null}
                    processedAt={s.processed_at ? new Date(s.processed_at).toISOString() : null}
                    costTokens={s.cost_tokens !== null ? Number(s.cost_tokens) : null}
                  />
                </p>
                <SessionStageProgress status={s.status} />
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
          ))
        )}
      </div>
    </div>
  );
}
