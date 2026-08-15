import { spawn } from "node:child_process";

/**
 * Probes the duration (in seconds) of the video at `filePath` via
 * ffprobe. Unlike worker/lib/ffmpeg.ts's runFfmpeg (which captures
 * stderr — ffmpeg's diagnostic channel), this captures stdout, since
 * that's where ffprobe writes -show_entries output.
 *
 * Throws on a missing/corrupt file or a missing ffprobe binary — the
 * caller must treat that as a pre-charge failure, never fall through to
 * charging a fallback amount.
 */
export function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    let stdout = "";
    let stderr = "";
    ffprobe.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    ffprobe.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    ffprobe.on("error", (err) => {
      reject(new Error(`failed to start ffprobe: ${err.message}`));
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}\n${stderr}`));
        return;
      }
      const seconds = parseFloat(stdout.trim());
      if (!Number.isFinite(seconds) || seconds <= 0) {
        reject(new Error(`ffprobe returned an unusable duration: "${stdout.trim()}"`));
        return;
      }
      resolvePromise(seconds);
    });
  });
}
