"use client";

import { motion } from "motion/react";

// Mirrors the real status values worker/index.ts writes at each actual
// pipeline stage (setStatus() calls interspersed between transcodeToMp4
// / extractSceneFrames / transcribeAudio / zipResults) — not a
// simulated/fake progress animation. sessions.status has always been
// plain TEXT with no CHECK constraint specifically so values like these
// could be added later, see CLAUDE.md "Decided: pipeline
// orchestration".
const STAGES = [
  { key: "transcoding", label: "Transcode" },
  { key: "detecting_scenes", label: "Detect scenes" },
  { key: "transcribing", label: "Transcribe" },
  { key: "packaging", label: "Package" },
] as const;

export default function SessionStageProgress({ status }: { status: string }) {
  const activeIndex = STAGES.findIndex((s) => s.key === status);
  if (activeIndex === -1) return null;

  // No labels here — the row's own status badge already shows the
  // current stage name (e.g. "PACKAGING…"); repeating all 4 labels
  // under a narrow row collided into unreadable run-together text.
  return (
    <div className="flex items-center mt-2 w-40" title={STAGES[activeIndex].label}>
      {STAGES.map((stage, i) => (
        <div key={stage.key} className={`flex items-center ${i < STAGES.length - 1 ? "flex-1" : ""}`}>
          <motion.div
            animate={i === activeIndex ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={i === activeIndex ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : undefined}
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              i < activeIndex
                ? "bg-[var(--color-accent)]"
                : i === activeIndex
                  ? "bg-[var(--color-sidebar)]"
                  : "bg-[var(--color-border)]"
            }`}
          />
          {i < STAGES.length - 1 && (
            <div className="flex-1 h-0.5 mx-1 bg-[var(--color-border)] rounded-full overflow-hidden">
              <motion.div
                initial={false}
                animate={{ scaleX: i < activeIndex ? 1 : 0 }}
                style={{ transformOrigin: "left" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full bg-[var(--color-accent)]"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
