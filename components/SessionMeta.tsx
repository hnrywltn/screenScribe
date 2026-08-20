"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// useSyncExternalStore, not useState+useEffect — the latter needs a
// setState call inside the effect purely to force a second render after
// mount, which is exactly the "cascading renders" anti-pattern the
// react-hooks/set-state-in-effect lint rule (correctly) flags.
// useSyncExternalStore is the React-endorsed way to give the server and
// client different snapshots for one value without that extra render.
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

type Props = {
  createdAt: string;
  status: string;
  expiresAt: string | null;
  processingStartedAt: string | null;
  processedAt: string | null;
  costTokens: number | null;
};

// Formats entirely on the client — toLocaleString()/toLocaleTimeString()
// use the browser's own timezone by default, unlike the server (which
// formats in whatever timezone the Railway container itself runs in,
// not the actual user's — real bug this fixes, not a hypothetical one).
// Renders nothing until after mount rather than formatting during SSR,
// so there's no server/client markup mismatch to reconcile — the brief
// blank flash is the tradeoff for correctness over a same-render value.
export default function SessionMeta({
  createdAt,
  status,
  expiresAt,
  processingStartedAt,
  processedAt,
  costTokens,
}: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return null;

  const parts: string[] = [new Date(createdAt).toLocaleString()];

  if (costTokens !== null) {
    parts.push(`${costTokens} token${costTokens === 1 ? "" : "s"}`);
  }

  if (processingStartedAt && processedAt) {
    const ms = new Date(processedAt).getTime() - new Date(processingStartedAt).getTime();
    parts.push(`processed in ${formatDuration(ms)}`);
  }

  if (status === "complete" && expiresAt) {
    parts.push(`Ready — download by ${new Date(expiresAt).toLocaleTimeString()}`);
  }

  return <>{parts.join(" · ")}</>;
}
