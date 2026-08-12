import { spawn } from "node:child_process";

/**
 * Transcodes `inputPath` to H.264/AAC .mp4 at `outputPath`.
 *
 * libx264/aac (not videotoolbox) so behavior matches between the Mac dev
 * machine and the Linux Railway worker in production — hardware encoders
 * differ per platform, software encoders don't. `+faststart` moves the
 * moov atom to the front so the file is playable while downloading
 * rather than only after the whole thing arrives.
 */
export function transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const args = [
      "-y", // overwrite outputPath if it already exists
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath,
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    ffmpeg.on("error", (err) => {
      // e.g. ENOENT — ffmpeg isn't installed / not on PATH
      reject(new Error(`failed to start ffmpeg: ${err.message}`));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      }
    });
  });
}
