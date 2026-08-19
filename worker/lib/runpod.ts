// Self-contained env loading — same reason as lib/db.ts/lib/b2.ts: ES
// module imports are hoisted, so this can't assume index.ts's own
// dotenv.config() already ran first.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";
const POLL_INTERVAL_MS = 5000;

type RunPodStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";

type RunPodStatusResponse = {
  id: string;
  status: RunPodStatus;
  output?: { status?: string; sessionId?: string; error?: string };
  error?: string;
};

function endpointUrl(path: string): string {
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!endpointId) throw new Error("RUNPOD_ENDPOINT_ID is not set");
  return `${RUNPOD_API_BASE}/${endpointId}${path}`;
}

function authHeader(): Record<string, string> {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("RUNPOD_API_KEY is not set");
  return { Authorization: `Bearer ${key}` };
}

/**
 * Runs the GPU pipeline (transcode + scene detection + transcription +
 * zip + upload to B2 — see worker/runpod-handler/handler.py) for
 * `sessionId` on RunPod Serverless, polling until the job reaches a
 * terminal state. Resolves once the finished zip already exists in B2 at
 * downloads/<sessionId>.zip (handler.py's own job); rejects on any
 * failure, timeout, or cancellation.
 *
 * Async /run + poll, not the synchronous /runsync endpoint — /runsync
 * enforces its own request timeout, unsuited to a job that can run for
 * several minutes of GPU time plus queue wait.
 */
export async function runGpuPipeline(sessionId: string): Promise<void> {
  const submitRes = await fetch(endpointUrl("/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ input: { sessionId } }),
  });
  if (!submitRes.ok) {
    throw new Error(`RunPod /run failed: ${submitRes.status} ${await submitRes.text()}`);
  }
  const { id: jobId } = (await submitRes.json()) as { id: string };

  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(endpointUrl(`/status/${jobId}`), { headers: authHeader() });
    if (!statusRes.ok) {
      throw new Error(`RunPod /status failed: ${statusRes.status} ${await statusRes.text()}`);
    }
    const body = (await statusRes.json()) as RunPodStatusResponse;

    if (body.status === "COMPLETED") return;
    if (body.status === "FAILED" || body.status === "CANCELLED" || body.status === "TIMED_OUT") {
      const reason = body.output?.error ?? body.error ?? body.status;
      throw new Error(`RunPod job ${jobId} for session ${sessionId} did not complete: ${reason}`);
    }
    // IN_QUEUE / IN_PROGRESS — keep polling.
  }
}
