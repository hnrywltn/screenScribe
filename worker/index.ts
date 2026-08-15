import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PgBoss } from "pg-boss";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import pool from "./lib/db";
import { transcodeToMp4, extractSceneFrames } from "./lib/ffmpeg";
import { uploadDir, workDir, downloadZipPath } from "./lib/tempStorage";
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

async function findUploadedFile(sessionId: string): Promise<string> {
  const dir = uploadDir(sessionId);
  const files = await readdir(dir);
  if (files.length === 0) throw new Error(`no uploaded file found in ${dir}`);
  return path.join(dir, files[0]);
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

async function processSession(sessionId: string): Promise<void> {
  await pool.query(`UPDATE sessions SET status = 'processing', updated_at = NOW() WHERE id = $1`, [sessionId]);

  const { rows } = await pool.query<{ email: string }>(
    `SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [sessionId]
  );
  if (rows.length === 0) throw new Error(`session ${sessionId} not found`);
  const userEmail = rows[0].email;

  const inputPath = await findUploadedFile(sessionId);
  const work = workDir(sessionId);
  const screenshotsDir = path.join(work, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });

  const outputMp4 = path.join(work, "video.mp4");
  await transcodeToMp4(inputPath, outputMp4);

  const screenshotPaths = await extractSceneFrames(inputPath, screenshotsDir);

  // whisper.cpp isn't installed yet (see CLAUDE.md -> "Decided:
  // transcription") — write an honest placeholder rather than pretending
  // transcription happened.
  const transcriptPath = path.join(work, "transcript.txt");
  await writeFile(
    transcriptPath,
    "Transcription is not available yet — this feature is still being built.\n\n" +
      "Screenshots and the converted video are still included in this download.\n"
  );

  const zipPath = downloadZipPath(sessionId);
  await zipResults(work, screenshotPaths, zipPath);

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

  // Clean up everything except the final zip — the raw upload and
  // intermediate work files (transcoded mp4, raw screenshots) have no
  // reason to survive past packaging.
  await rm(uploadDir(sessionId), { recursive: true, force: true });
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
    await rm(downloadZipPath(id), { force: true });
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
