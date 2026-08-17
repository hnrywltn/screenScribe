import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
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
  return runFfmpeg([
    "-y", // overwrite outputPath if it already exists
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

/**
 * Extracts one screenshot per detected slide/scene change from
 * `inputPath` into `outputDir` (must already exist), returning the paths
 * of the frames produced, in order.
 *
 * Uses ffmpeg's own scene-change score (`select='gt(scene,threshold)'`)
 * rather than a separate frame-diffing library or dedicated
 * scene-detection package — it's already the tool this project shells
 * out to, so this adds no new dependency. A slide change in a screen
 * recording is normally a single abrupt full-frame cut (unlike a natural
 * video's gradual scene changes), which the scene score is well suited
 * to catch even at a fairly low threshold, while ignoring small
 * differences like cursor movement between otherwise-identical frames.
 *
 * `eq(n,0)` always includes the very first frame — the first slide is
 * never a detected "change" from a prior frame, so without this it would
 * be silently missing from the output (confirmed empirically: a 3-slide
 * test video produces only 2 scene-change frames without it).
 *
 * `threshold` (0–1, ffmpeg's own scale) defaults to 0.3, a commonly-cited
 * ffmpeg starting point — not tuned against real slide-deck recordings
 * yet, may need adjustment once tested against one.
 */
export async function extractSceneFrames(
  inputPath: string,
  outputDir: string,
  threshold = 0.3,
): Promise<string[]> {
  const outputPattern = path.join(outputDir, "screenshot-%04d.png");

  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vf", `select='eq(n\\,0)+gt(scene\\,${threshold})'`,
    "-fps_mode", "vfr",
    outputPattern,
  ]);

  const files = await readdir(outputDir);
  return files
    .filter((f) => f.startsWith("screenshot-") && f.endsWith(".png"))
    .sort()
    .map((f) => path.join(outputDir, f));
}

/**
 * Extracts audio from `inputPath` to a 16kHz mono WAV at `outputPath` —
 * the exact format whisper.cpp expects (see worker/lib/whisper.ts). A
 * separate step from transcodeToMp4 since the mp4's own AAC audio
 * stream isn't in a format whisper.cpp can read directly.
 */
export function extractAudioWav(inputPath: string, outputPath: string): Promise<void> {
  return runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vn",
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    outputPath,
  ]);
}
