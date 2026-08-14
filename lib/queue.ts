import { PgBoss } from "pg-boss";

// Must match worker/index.ts's queue name — the worker is what actually
// consumes these jobs, this side only sends them.
const QUEUE_PROCESS_SESSION = "process-session";

let bossPromise: Promise<PgBoss> | null = null;

function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
      boss.on("error", (err) => console.error("pg-boss error (web app queue client):", err));
      await boss.start();
      // Idempotent — safe even if the worker hasn't created it yet, or
      // isn't running at all when a job gets sent.
      await boss.createQueue(QUEUE_PROCESS_SESSION);
      return boss;
    })();
  }
  return bossPromise;
}

export async function sendProcessSessionJob(sessionId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE_PROCESS_SESSION, { sessionId });
}
