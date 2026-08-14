"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server component tree on an interval so session status
// (queued -> processing -> complete) updates without a manual reload.
// Simple polling, not a websocket/SSE — the queue page isn't something
// users are expected to stare at live, just check back on periodically.
export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
