"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Sessions", href: "/sessions" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="shrink-0 w-56 bg-[var(--color-sidebar)] min-h-screen flex flex-col">
      <div className="border-b border-white/10 px-5 py-6">
        <Link href="/" className="block hover:opacity-80 transition-opacity">
          <p className="text-white/40 text-xs uppercase tracking-widest font-medium">ScreenScribe</p>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0 bg-[var(--color-accent)]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
