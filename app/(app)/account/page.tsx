export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import AccountForm from "@/components/AccountForm";

export default async function AccountPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login"); // (app)/layout.tsx already gates this — defensive

  const { rows } = await pool.query<{ email: string; phone: string | null; sms_opt_in: boolean }>(
    `SELECT email, phone, sms_opt_in FROM users WHERE id = $1`,
    [userId]
  );
  const { email, phone, sms_opt_in } = rows[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Account</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">{email}</p>

      <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <h2 className="font-medium text-[var(--color-text)]">Text notifications</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Add a phone number to get texted when your video starts processing and when it&apos;s ready to download.
        </p>
        <div className="mt-4">
          <AccountForm initialPhone={phone ?? ""} initialSmsOptIn={sms_opt_in} />
        </div>
      </div>
    </div>
  );
}
