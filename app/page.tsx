export const dynamic = "force-dynamic";

import pool from "@/lib/db";
import NewSessionWidget from "@/components/NewSessionWidget";
import SessionsWidget from "@/components/SessionsWidget";

export default async function Home() {
  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM sessions`);
  const sessionCount = rows[0].count;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-8">Home</h1>

      <div className="grid grid-cols-2 gap-5">
        <NewSessionWidget />
        <SessionsWidget sessionCount={sessionCount} />
      </div>
    </div>
  );
}
