import path from "node:path";

// LOCAL DEV ONLY convention — must agree with the web app's
// lib/tempStorage.ts (a duplicate, not a shared import; separate npm
// packages). See .env.local's SHARED_TEMP_DIR comment for why this
// exists at all and what replaces it in production.
function baseDir(): string {
  const dir = process.env.SHARED_TEMP_DIR;
  if (!dir) throw new Error("SHARED_TEMP_DIR is not set");
  return dir;
}

export function uploadDir(sessionId: string): string {
  return path.join(baseDir(), "uploads", sessionId);
}

// Worker-only scratch space for intermediate ffmpeg output (transcoded
// mp4, extracted screenshots) before they're zipped — the web app never
// needs this, only the final zip.
export function workDir(sessionId: string): string {
  return path.join(baseDir(), "work", sessionId);
}

export function downloadZipPath(sessionId: string): string {
  return path.join(baseDir(), "downloads", `${sessionId}.zip`);
}
