"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { label: "Home", href: "/dashboard", tour: "nav-home" },
  { label: "Sessions", href: "/sessions", tour: "nav-sessions" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar (below md) */}
      <header className="md:hidden shrink-0 bg-[var(--color-sidebar)] border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" data-tour="brand" className="text-white/40 text-xs uppercase tracking-widest font-medium hover:opacity-80 transition-opacity shrink-0">
          ScreenScribe
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(item.href) ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={logOut}
            className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            Log out
          </button>
        </nav>
      </header>

      {/* Desktop sidebar (md and up) */}
      <aside className="hidden md:flex shrink-0 w-56 bg-[var(--color-sidebar)] min-h-screen flex-col">
        <div className="border-b border-white/10 px-5 py-6">
          <Link href="/dashboard" data-tour="brand" className="block hover:opacity-80 transition-opacity">
            <p className="text-white/40 text-xs uppercase tracking-widest font-medium">ScreenScribe</p>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.href) ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0 bg-[var(--color-accent)]" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            <span className="w-2 h-2 rounded-full shrink-0 bg-white/30" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
