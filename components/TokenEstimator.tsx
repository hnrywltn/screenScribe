"use client";

import { useState } from "react";

const DOLLARS_PER_TOKEN = 0.2;

// Illustrative only — there's no upload flow yet to probe a real file's
// duration. Once one exists, this same 1-token-per-minute math is meant
// to be reused against the actual probed length, not just this slider.
export default function TokenEstimator() {
  const [minutes, setMinutes] = useState(30);
  const tokens = Math.max(1, Math.ceil(minutes));
  const cost = (tokens * DOLLARS_PER_TOKEN).toFixed(2);

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 max-w-md mx-auto">
      <label htmlFor="minutes" className="block text-sm font-medium text-[var(--color-text)] mb-2">
        How long is your video?
      </label>
      <div className="flex items-center gap-3">
        <input
          id="minutes"
          type="range"
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="flex-1 accent-[var(--color-sidebar)]"
        />
        <span className="text-sm text-[var(--color-muted)] w-20 text-right shrink-0">{minutes} min</span>
      </div>
      <p className="mt-4 text-center">
        <span className="text-2xl font-semibold text-[var(--color-text)]">{tokens} tokens</span>
        <span className="text-sm text-[var(--color-muted)]"> · ${cost} pay-as-you-go</span>
      </p>
    </div>
  );
}
