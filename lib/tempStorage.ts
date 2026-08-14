import path from "node:path";

// LOCAL DEV ONLY convention — see .env.local's SHARED_TEMP_DIR comment.
// Both the web app and worker/lib/tempStorage.ts (a duplicate, not a
// shared import — separate npm packages) must agree on this layout.
function baseDir(): string {
  const dir = process.env.SHARED_TEMP_DIR;
  if (!dir) throw new Error("SHARED_TEMP_DIR is not set");
  return dir;
}

export function uploadDir(sessionId: string): string {
  return path.join(baseDir(), "uploads", sessionId);
}

export function downloadZipPath(sessionId: string): string {
  return path.join(baseDir(), "downloads", `${sessionId}.zip`);
}
