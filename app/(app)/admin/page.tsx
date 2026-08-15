export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import GrantTokensForm from "@/components/GrantTokensForm";

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email_verified_at: string | null;
  is_admin: boolean;
  token_balance: number;
  created_at: string;
  session_count: number;
  revenue_cents: number;
};

export default async function AdminPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { rows: self } = await pool.query<{ is_admin: boolean }>(`SELECT is_admin FROM users WHERE id = $1`, [
    userId,
  ]);
  if (!self[0]?.is_admin) redirect("/dashboard");

  const { rows: revenueRows } = await pool.query<{ total_cents: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS total_cents FROM token_grants WHERE amount_cents IS NOT NULL`
  );
  const totalRevenue = (revenueRows[0].total_cents / 100).toFixed(2);

  const { rows: users } = await pool.query<UserRow>(
    `SELECT
       u.id, u.email, u.first_name, u.last_name, u.phone, u.email_verified_at, u.is_admin, u.token_balance, u.created_at,
       COALESCE((SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id), 0)::int AS session_count,
       COALESCE((SELECT SUM(g.amount_cents) FROM token_grants g WHERE g.user_id = u.id), 0)::int AS revenue_cents
     FROM users u
     ORDER BY u.created_at DESC`
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Admin</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">Visible only to admin accounts.</p>

      <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Total revenue</p>
        <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">${totalRevenue}</p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Seeded/test data — no live payment processor is connected yet. This will reflect real numbers once billing
          exists.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Verified</th>
                <th className="py-2 pr-4">Sessions</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2 pr-4">Tokens</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2">Grant tokens</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)]/60">
                  <td className="py-2.5 pr-4 text-[var(--color-text)] whitespace-nowrap">
                    {u.first_name || u.last_name ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text)] whitespace-nowrap">
                    {u.email}
                    {u.is_admin && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)] border border-[var(--color-border)] rounded px-1 py-0.5">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-muted)]">{u.phone ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-muted)]">{u.email_verified_at ? "Yes" : "No"}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-text)]">{u.session_count}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-text)]">${(u.revenue_cents / 100).toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-text)]">{u.token_balance}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-muted)] whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5">
                    <GrantTokensForm userId={u.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
