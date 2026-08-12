export const dynamic = "force-dynamic";

import pool from "@/lib/db";
import NewSessionWidget from "@/components/NewSessionWidget";
import SessionsWidget from "@/components/SessionsWidget";
import TutorialButton from "@/components/TutorialButton";

export default async function Home() {
  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM sessions`);
  const sessionCount = rows[0].count;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Home</h1>
        <TutorialButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <NewSessionWidget />
        <SessionsWidget sessionCount={sessionCount} />
      </div>
    </div>
  );
}
