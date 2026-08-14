export const dynamic = "force-dynamic";

import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewSessionWidget from "@/components/NewSessionWidget";
import SessionsWidget from "@/components/SessionsWidget";
import TutorialButton from "@/components/TutorialButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login"); // (app)/layout.tsx already gates this — defensive

  const { verified } = await searchParams;

  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM sessions WHERE user_id = $1`, [userId]);
  const sessionCount = rows[0].count;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {verified === "success" && (
        <p className="mb-4 text-sm text-[var(--color-text)] bg-[var(--color-accent)]/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5">
          Email verified — thanks!
        </p>
      )}
      {verified === "error" && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          That verification link is invalid or expired — request a new one below.
        </p>
      )}
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
