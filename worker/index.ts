import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PgBoss } from "pg-boss";
import pool from "./lib/db";
import { downloadZipKey, deleteObject } from "./lib/b2";
import { runGpuPipeline } from "./lib/runpod";
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

async function processSession(sessionId: string): Promise<void> {
  // sessions.status is plain TEXT with no CHECK constraint specifically
  // so values could be added/changed without a migration — see CLAUDE.md
  // "Decided: pipeline orchestration". Used to carry granular per-stage
  // values (transcoding/detecting_scenes/transcribing/packaging) driving
  // the Sessions page's animated stepper (SessionStageProgress.tsx); now
  // that the pipeline runs as one opaque RunPod job (see runGpuPipeline
  // below), there's no visibility into which internal step it's on, so
  // it stays "processing" for the whole duration instead — a real,
  // known regression in that stepper's granularity, not an oversight.
  //
  // processing_started_at, not updated_at — updated_at gets overwritten
  // by every later transition (complete -> downloaded -> expired), so it
  // can't be trusted to still hold this moment by the time the Sessions
  // page reads it to show "processed in Nm Ns".
  await pool.query(
    `UPDATE sessions SET status = 'processing', processing_started_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  const { rows } = await pool.query<{ email: string }>(
    `SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [sessionId]
  );
  if (rows.length === 0) throw new Error(`session ${sessionId} not found`);
  const userEmail = rows[0].email;

  // The GPU pipeline (transcode, scene detection, transcription, zip,
  // upload to B2) now runs entirely on RunPod Serverless — see
  // worker/runpod-handler/handler.py. It downloads the raw upload from
  // B2, produces downloads/<sessionId>.zip, and deletes the upload
  // object itself; nothing local to do here anymore.
  await runGpuPipeline(sessionId);

  await pool.query(
    `UPDATE sessions SET status = 'complete', expires_at = NOW() + INTERVAL '1 hour', processed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  try {
    await sendDownloadReadyEmail(userEmail);
  } catch (err) {
    // A failed notification shouldn't fail an otherwise-successful job.
    console.error(`failed to send ready email for session ${sessionId}:`, err);
  }
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
