export const dynamic = "force-dynamic";

import pool from "@/lib/db";

export default async function SessionsPage() {
  const { rows: sessions } = await pool.query(
    `SELECT id, name, status, created_at FROM sessions ORDER BY created_at DESC`
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sessions</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] mt-4">No sessions yet — upload a recording to get started.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-[var(--color-border)] px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="font-medium text-[var(--color-text)] truncate min-w-0">{s.name}</span>
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)] shrink-0">{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
