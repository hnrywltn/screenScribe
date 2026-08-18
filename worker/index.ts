import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PgBoss } from "pg-boss";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import pool from "./lib/db";
import { transcodeToMp4, extractSceneFrames, extractAudioWav } from "./lib/ffmpeg";
import { transcribeAudio } from "./lib/whisper";
import { workDir } from "./lib/tempStorage";
import { findUploadKey, downloadZipKey, getObjectStream, putObjectStream, deleteObject } from "./lib/b2";
import { sendDownloadReadyEmail } from "./lib/email";
import { refundUsageCharge } from "./lib/tokens";

// A session row already carries user_id/original_filename/status in
// Postgres (see lib/migrate.ts) — the job payload only needs to say which
// one to work on, everything else is looked up from the DB.
type ProcessSessionJob = {
  sessionId: string;
};

const QUEUE_PROCESS_SESSION = "process-session";
const QUEUE_CLEANUP = "cleanup-expired-sessions";

// Downloads the raw upload from B2 to worker-local disk — ffmpeg needs
// a real file path to read from, not a stream. Returns both the local
// path (for processing) and the B2 key (so it can be deleted once
// processing succeeds).
async function downloadInputFile(sessionId: string, work: string): Promise<{ localPath: string; key: string }> {
  const key = await findUploadKey(sessionId);
  const filename = key.split("/").pop() ?? "input";
  const inputDir = path.join(work, "input");
  await mkdir(inputDir, { recursive: true });
  const localPath = path.join(inputDir, filename);
  const stream = await getObjectStream(key);
  await pipeline(stream, createWriteStream(localPath));
  return { localPath, key };
}

async function zipResults(workDirPath: string, screenshotPaths: string[], outputZipPath: string): Promise<void> {
  await mkdir(path.dirname(outputZipPath), { recursive: true });

  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(outputZipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", () => resolvePromise());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.file(path.join(workDirPath, "video.mp4"), { name: "video.mp4" });
    archive.file(path.join(workDirPath, "transcript.txt"), { name: "transcript.txt" });
    for (const screenshotPath of screenshotPaths) {
      archive.file(screenshotPath, { name: `screenshots/${path.basename(screenshotPath)}` });
    }
    archive.finalize();
  });
}

// Real per-stage status, not just a single "processing" catch-all — the
// Sessions page uses these exact values to drive an animated stepper
// (SessionStageProgress.tsx). sessions.status has always been plain
// TEXT with no CHECK constraint specifically so intermediate values
// like these could be added later without a migration — see CLAUDE.md
// "Decided: pipeline orchestration".
async function setStatus(sessionId: string, status: string): Promise<void> {
  await pool.query(`UPDATE sessions SET status = $2, updated_at = NOW() WHERE id = $1`, [sessionId, status]);
}

async function processSession(sessionId: string): Promise<void> {
  await setStatus(sessionId, "processing");

  const { rows } = await pool.query<{ email: string }>(
    `SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [sessionId]
  );
  if (rows.length === 0) throw new Error(`session ${sessionId} not found`);
  const userEmail = rows[0].email;

  const work = workDir(sessionId);
  const screenshotsDir = path.join(work, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });

  const { localPath: inputPath, key: uploadObjectKey } = await downloadInputFile(sessionId, work);

  await setStatus(sessionId, "transcoding");
  const outputMp4 = path.join(work, "video.mp4");
  await transcodeToMp4(inputPath, outputMp4);

  await setStatus(sessionId, "detecting_scenes");
  const screenshotPaths = await extractSceneFrames(inputPath, screenshotsDir);

  await setStatus(sessionId, "transcribing");
  const transcriptPath = path.join(work, "transcript.txt");
  try {
    const audioPath = path.join(work, "audio.wav");
    await extractAudioWav(inputPath, audioPath);
    const transcript = await transcribeAudio(audioPath);
    await writeFile(transcriptPath, transcript + "\n");
  } catch (err) {
    // A failed transcription shouldn't fail an otherwise-successful job
    // — the video and screenshots are still worth delivering. Same
    // "don't fake it, say so honestly" principle as the old placeholder,
    // just now covering the failure case specifically rather than
    // always.
    console.error(`transcription failed for session ${sessionId}:`, err);
    await writeFile(
      transcriptPath,
      "Transcription failed for this video — this is a known-error case, not a fake transcript.\n\n" +
        "Screenshots and the converted video are still included in this download.\n"
    );
  }

  await setStatus(sessionId, "packaging");
  const localZipPath = path.join(work, "output.zip");
  await zipResults(work, screenshotPaths, localZipPath);

  await putObjectStream(downloadZipKey(sessionId), createReadStream(localZipPath), "application/zip");

  // The raw upload has no reason to survive past packaging — the B2
  // object, not local disk, is the thing that used to be uploadDir().
  await deleteObject(uploadObjectKey);

  await pool.query(
    `UPDATE sessions SET status = 'complete', expires_at = NOW() + INTERVAL '1 hour', updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  try {
    await sendDownloadReadyEmail(userEmail);
  } catch (err) {
    // A failed notification shouldn't fail an otherwise-successful job.
    console.error(`failed to send ready email for session ${sessionId}:`, err);
  }

  // Clean up all worker-local scratch — the downloaded input, ffmpeg
  // output, and the local zip copy have no reason to survive past
  // upload to B2.
  await rm(work, { recursive: true, force: true });
}

// Real scheduled sweep, not the lazy-only check the download route relies
// on today — that check remains as a backstop for the (rare) window
// between a session actually expiring and the next run of this job, not
// the sole enforcement mechanism anymore.
async function cleanupExpiredSessions(): Promise<void> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM sessions WHERE status = 'complete' AND expires_at < NOW()`
  );
  for (const { id } of rows) {
    await deleteObject(downloadZipKey(id));
    await pool.query(`UPDATE sessions SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'complete'`, [
      id,
    ]);
  }

  // Prune old rate-limit attempt rows here too — cheap to fold in since
  // this scheduled-job infrastructure exists now anyway, rather than
  // letting rate_limit_attempts grow forever.
  await pool.query(`DELETE FROM rate_limit_attempts WHERE created_at < NOW() - INTERVAL '24 hours'`);
}

async function main() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on("error", (err) => console.error("pg-boss error:", err));

  await boss.start();
  // retryLimit: 0 — processSession() isn't written to be safely
  // re-entrant (it unconditionally marks 'processing' at the top with
  // no check of current status), and the refund-on-failure logic below
  // would double-refund the same charge if pg-boss's default retries
  // (2, otherwise) re-ran a failed job. updateQueue() is a one-time
  // fixup for this queue if it already existed with the old default.
  await boss.createQueue(QUEUE_PROCESS_SESSION, { retryLimit: 0 });
  await boss.updateQueue(QUEUE_PROCESS_SESSION, { retryLimit: 0 });
  console.log(`worker started, listening on "${QUEUE_PROCESS_SESSION}"`);

  await boss.work<ProcessSessionJob>(QUEUE_PROCESS_SESSION, async ([job]) => {
    const { sessionId } = job.data;
    console.log(`processing session ${sessionId} (job ${job.id})`);
    try {
      await processSession(sessionId);
      console.log(`session ${sessionId} complete`);
    } catch (err) {
      console.error(`session ${sessionId} failed:`, err);
      await pool.query(
        `UPDATE sessions SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
        [sessionId, err instanceof Error ? err.message : String(err)]
      );
      // Refund the upload charge, if any — idempotency-guarded, so this
      // is safe even if retryLimit:0 above somehow doesn't take effect.
      const refundClient = await pool.connect();
      try {
        await refundClient.query("BEGIN");
        await refundUsageCharge(refundClient, sessionId);
        await refundClient.query("COMMIT");
      } catch (refundErr) {
        await refundClient.query("ROLLBACK");
        console.error(`refund also failed for session ${sessionId}:`, refundErr);
      } finally {
        refundClient.release();
      }
      // Re-throw so pg-boss also records the job itself as failed, not
      // just the session row.
      throw err;
    }
  });

  // Scheduled cleanup sweep — retryLimit deliberately left at pg-boss's
  // default (2), unlike process-session above: this handler is naturally
  // idempotent (conditional UPDATE, force-rm), so a retry on a transient
  // failure is harmless and even desirable.
  await boss.createQueue(QUEUE_CLEANUP);
  await boss.schedule(QUEUE_CLEANUP, "*/15 * * * *", null, {});
  await boss.work(QUEUE_CLEANUP, async () => {
    console.log("running scheduled cleanup sweep");
    await cleanupExpiredSessions();
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      console.log(`${signal} received, shutting down`);
      await boss.stop();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error("worker failed to start:", err);
  process.exit(1);
});
