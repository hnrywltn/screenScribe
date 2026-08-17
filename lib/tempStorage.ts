import path from "node:path";

function baseDir(): string {
  const dir = process.env.LOCAL_SCRATCH_DIR;
  if (!dir) throw new Error("LOCAL_SCRATCH_DIR is not set");
  return dir;
}

// Local-only scratch space for briefly writing an uploaded file so
// ffprobe (a local binary) can read its duration before the bytes go to
// B2 — no longer a handoff to the worker, see lib/b2.ts for that.
export function scratchDir(sessionId: string): string {
  return path.join(baseDir(), "uploads", sessionId);
}
