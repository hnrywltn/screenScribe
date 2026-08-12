import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PgBoss } from "pg-boss";

// A session row already carries user_id/original_filename/status in
// Postgres (see lib/migrate.ts) — the job payload only needs to say which
// one to work on, everything else is looked up from the DB.
type ProcessSessionJob = {
  sessionId: string;
};

const QUEUE_PROCESS_SESSION = "process-session";

async function main() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on("error", (err) => console.error("pg-boss error:", err));

  await boss.start();
  await boss.createQueue(QUEUE_PROCESS_SESSION);
  console.log(`worker started, listening on "${QUEUE_PROCESS_SESSION}"`);

  // Stub handler — nothing produces jobs on this queue yet (no upload
  // endpoint exists in the web app to call boss.send()), and the pipeline
  // itself (ffmpeg transcode, scene detection, whisper.cpp transcription,
  // zip + hand back to the web app over Railway's private network) isn't
  // built. This just proves the worker can receive and complete a job.
  await boss.work<ProcessSessionJob>(QUEUE_PROCESS_SESSION, async ([job]) => {
    console.log(`received job ${job.id} for session ${job.data.sessionId} — pipeline not implemented yet`);
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
