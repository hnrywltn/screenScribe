export const dynamic = "force-dynamic";

import pool from "@/lib/db";

export default async function SessionsPage() {
  // Not yet scoped to the logged-in user — no auth session to filter by.
  // Lists every session in the DB until login exists.
  const { rows: sessions } = await pool.query(
    `SELECT id, original_filename, status, created_at FROM sessions ORDER BY created_at DESC`
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sessions</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">
        A history of what you&apos;ve processed. Downloads are one-time — nothing is stored after the zip is generated.
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
                <p className="text-xs text-[var(--color-muted)]">{new Date(s.created_at).toLocaleString()}</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)] shrink-0">{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
