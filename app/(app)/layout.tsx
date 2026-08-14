import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { rows } = await pool.query<{ email_verified_at: string | null }>(
    `SELECT email_verified_at FROM users WHERE id = $1`,
    [userId]
  );
  const isVerified = Boolean(rows[0]?.email_verified_at);

  return (
    <div className="h-full flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        {!isVerified && <VerifyEmailBanner />}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
