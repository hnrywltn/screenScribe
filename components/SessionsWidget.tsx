import Link from "next/link";
import { FileVideo } from "lucide-react";

export default function SessionsWidget({ sessionCount }: { sessionCount: number }) {
  return (
    <Link
      href="/sessions"
      className="h-56 bg-white rounded-3xl border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileVideo className="w-4 h-4 text-[var(--color-muted)]" />
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Sessions</span>
        </div>
        <span className="text-2xl font-semibold text-[var(--color-text)]">{sessionCount}</span>
      </div>
      <p className="text-sm text-[var(--color-muted)]">View processed sessions</p>
    </Link>
  );
}
