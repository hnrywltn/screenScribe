import { spawn } from "node:child_process";

/**
 * Runs whisper.cpp against a 16kHz mono WAV file (see
 * extractAudioWav in ffmpeg.ts), returning the timestamped transcript
 * exactly as whisper-cli prints it to stdout. Its own backend/model
 * diagnostic logging goes to stderr instead — same stdout/stderr split
 * convention already used for ffprobe (real output) vs ffmpeg (its
 * diagnostic channel) elsewhere in this package. Confirmed empirically,
 * not assumed from the CLI's docs.
 *
 * WHISPER_MODEL_PATH points at a quantized ggml model file — see
 * CLAUDE.md "Decided: transcription" for why `medium`, quantized (a
 * `q5_0`-class model chosen here after comparing against `q4_0` for
 * accuracy, both meeting the already-established "faster than
 * real-time" bar). Differs between local dev (a manually-downloaded
 * .bin) and production (baked into the worker's Docker image at build
 * time, see worker/Dockerfile).
 */
export function transcribeAudio(wavPath: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const modelPath = process.env.WHISPER_MODEL_PATH;
    if (!modelPath) {
      reject(new Error("WHISPER_MODEL_PATH is not set"));
      return;
    }

    const binary = process.env.WHISPER_BINARY || "whisper-cli";
    const threads = process.env.WHISPER_THREADS || "4";

    const whisper = spawn(binary, ["-m", modelPath, "-f", wavPath, "-np", "-t", threads]);

    let stdout = "";
    let stderr = "";
    whisper.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    whisper.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    whisper.on("error", (err) => {
      // e.g. ENOENT — whisper-cli isn't installed / not on PATH
      reject(new Error(`failed to start whisper-cli: ${err.message}`));
    });

    whisper.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`whisper-cli exited with code ${code}\n${stderr}`));
        return;
      }
      const transcript = stdout.trim();
      if (!transcript) {
        reject(new Error("whisper-cli produced an empty transcript"));
        return;
      }
      resolvePromise(transcript);
    });
  });
}
