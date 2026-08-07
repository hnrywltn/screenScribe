import Link from "next/link";
import { Upload } from "lucide-react";

export default function NewSessionWidget() {
  return (
    <Link
      href="/upload"
      className="h-56 rounded-3xl bg-[var(--color-sidebar)] hover:bg-[var(--color-sidebar-hover)] transition-colors p-5 flex flex-col justify-between text-white"
    >
      <Upload className="w-6 h-6 text-white/70" />
      <div>
        <p className="font-medium">New Session</p>
        <p className="text-xs text-white/50 mt-0.5">Upload a recording to process</p>
      </div>
    </Link>
  );
}
