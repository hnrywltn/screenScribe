import path from "node:path";

function baseDir(): string {
  const dir = process.env.LOCAL_SCRATCH_DIR;
  if (!dir) throw new Error("LOCAL_SCRATCH_DIR is not set");
  return dir;
}

// Worker-only local scratch space — no longer shared with the web app.
// B2 (see lib/b2.ts) is the real handoff now; this is just where the
// worker keeps its own intermediate files (downloaded input, ffmpeg
// output, the zip before it's uploaded to B2) while working a session.
export function workDir(sessionId: string): string {
  return path.join(baseDir(), "work", sessionId);
}
