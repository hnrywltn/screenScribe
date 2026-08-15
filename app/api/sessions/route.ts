export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { sendProcessSessionJob } from "@/lib/queue";
import { uploadDir } from "@/lib/tempStorage";
import { probeDurationSeconds } from "@/lib/ffprobe";
import { chargeTokens, refundUsageCharge } from "@/lib/tokens";

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB, matches UploadDropzone's client-side check

async function markFailed(sessionId: string, message: string) {
  await pool.query(`UPDATE sessions SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, [
    sessionId,
    message,
  ]);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No video file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Please upload a video file." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "That file is too large — max 2GB for now." }, { status: 400 });
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO sessions (user_id, original_filename) VALUES ($1, $2) RETURNING id`,
    [userId, file.name]
  );
  const sessionId = rows[0].id;
  const dir = uploadDir(sessionId);

  let filePath: string;
  try {
    await mkdir(dir, { recursive: true });
    // Buffers the whole file in memory before writing — fine at this
    // scale/stage, but a real memory-pressure concern for large uploads
    // under real concurrent traffic. Streaming straight to disk would
    // avoid it; not built, see docs/tech-stack/architecture.md.
    const buffer = Buffer.from(await file.arrayBuffer());
    filePath = path.join(dir, file.name);
    await writeFile(filePath, buffer);
  } catch (err) {
    console.error("Upload failed writing file to disk:", err);
    await markFailed(sessionId, "Upload failed on the server — please try again.");
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }

  // Probe duration before charging anything — an unreadable/corrupt file
  // is a pre-charge failure, never falls through to charging a fallback
  // amount.
  let cost: number;
  try {
    const seconds = await probeDurationSeconds(filePath);
    cost = Math.max(1, Math.ceil(seconds / 60)); // 1 token per minute, rounded up, minimum 1
  } catch (err) {
    console.error("Could not probe video duration:", err);
    await markFailed(sessionId, "That file doesn't look like a valid video.");
    await rm(dir, { recursive: true, force: true });
    return NextResponse.json({ error: "That file doesn't look like a valid video." }, { status: 400 });
  }

  // Charge atomically: allowed to go as low as -100 tokens (a shortage
  // shouldn't block an upload outright — it's paid off by the user's
  // next purchase), but no further.
  const chargeClient = await pool.connect();
  let newBalance: number | null;
  try {
    await chargeClient.query("BEGIN");
    newBalance = await chargeTokens(chargeClient, userId, cost, "usage_upload", sessionId);
    await chargeClient.query(newBalance === null ? "ROLLBACK" : "COMMIT");
  } catch (err) {
    await chargeClient.query("ROLLBACK");
    throw err;
  } finally {
    chargeClient.release();
  }

  if (newBalance === null) {
    const { rows: balanceRows } = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM users WHERE id = $1`,
      [userId]
    );
    const currentBalance = balanceRows[0]?.token_balance ?? 0;
    const shortfall = cost - 100 - currentBalance;
    const message = `Not enough tokens for this video — you need ${shortfall} more.`;
    await markFailed(sessionId, message);
    await rm(dir, { recursive: true, force: true });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await sendProcessSessionJob(sessionId);
    return NextResponse.json({ ok: true, sessionId });
  } catch (err) {
    // Tokens were already charged above — refund them, since the job
    // never made it to the worker to do so itself.
    console.error("Upload failed after charging tokens:", err);
    const refundClient = await pool.connect();
    try {
      await refundClient.query("BEGIN");
      await refundUsageCharge(refundClient, sessionId);
      await refundClient.query("COMMIT");
    } catch (refundErr) {
      await refundClient.query("ROLLBACK");
      console.error("Refund also failed for session", sessionId, refundErr);
    } finally {
      refundClient.release();
    }
    await markFailed(sessionId, "Upload failed on the server — please try again.");
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
