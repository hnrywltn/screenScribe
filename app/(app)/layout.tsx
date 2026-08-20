import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import UploadProvider from "@/components/UploadProvider";
import Footer from "@/components/Footer";
// import VerifyEmailBanner from "@/components/VerifyEmailBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { rows } = await pool.query<{ email_verified_at: string | null; is_admin: boolean; token_balance: number }>(
    `SELECT email_verified_at, is_admin, token_balance FROM users WHERE id = $1`,
    [userId]
  );
  // const isVerified = Boolean(rows[0]?.email_verified_at);
  const isAdmin = Boolean(rows[0]?.is_admin);
  const tokenBalance = rows[0]?.token_balance ?? 0;

  return (
    <UploadProvider>
      <div className="h-full flex flex-col md:flex-row">
        <Sidebar isAdmin={isAdmin} tokenBalance={tokenBalance} />
        <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
          {/* Banner disabled until a Resend sending domain is verified —
              right now it nags every unverified user with an email that
              can never actually arrive. Re-enable by uncommenting this
              and the two lines above once that's fixed. */}
          <div className="flex-1">{children}</div>
          <Footer />
        </main>
      </div>
    </UploadProvider>
  );
}
