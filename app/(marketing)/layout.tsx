import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import Footer from "@/components/Footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--color-border)] px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="text-xs uppercase tracking-widest font-medium text-[var(--color-text)]">
          StudyBeacon
        </Link>
        {userId ? (
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--color-text)] hover:opacity-70 transition-opacity">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
