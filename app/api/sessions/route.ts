export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mkdir, rm, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { sendProcessSessionJob } from "@/lib/queue";
import { scratchDir } from "@/lib/tempStorage";
import { probeDurationSeconds } from "@/lib/ffprobe";
import { chargeTokens, refundUsageCharge } from "@/lib/tokens";
import { putObjectStream, deleteObject, uploadKey } from "@/lib/b2";
import { sendUploadReceivedSms } from "@/lib/sms";

const MAX_SIZE_BYTES = 6 * 1024 * 1024 * 1024; // 6GB — headroom above the ~5GB real-world ceiling; matches the client-side check
const MAX_SIZE_MESSAGE = "That file is too large — max 6GB for now.";

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

  // Raw streamed body, not multipart/form-data — form-data parsing
  // (request.formData()) buffers the entire file into memory before
  // handing it back, which is exactly what streaming straight to disk
  // is meant to avoid at multi-GB scale. The filename travels as a
  // header instead of a form field (see components/UploadProvider.tsx).
  if (!request.body) {
    return NextResponse.json({ error: "No video file provided." }, { status: 400 });
  }
  const filenameHeader = request.headers.get("x-filename");
  const filename = filenameHeader ? decodeURIComponent(filenameHeader) : null;
  if (!filename) {
    return NextResponse.json({ error: "No video file provided." }, { status: 400 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Please upload a video file." }, { status: 400 });
  }
  // A cheap upfront rejection when the browser sends Content-Length (it
  // always does for a File body — the size is known, no chunked
  // encoding needed) — avoids receiving any bytes for an obviously
  // oversized file. Not the only guard: the actual written size is
  // checked again after streaming to disk, in case this header is ever
  // missing or wrong.
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
  if (contentLength !== null && contentLength > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: MAX_SIZE_MESSAGE }, { status: 400 });
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO sessions (user_id, original_filename) VALUES ($1, $2) RETURNING id`,
    [userId, filename]
  );
  const sessionId = rows[0].id;
  // Local-only scratch dir, not a handoff to the worker anymore — just
  // needed briefly so ffprobe (a local binary) can read the file's
  // duration before the bytes go to B2.
  const dir = scratchDir(sessionId);

  let filePath: string;
  try {
    await mkdir(dir, { recursive: true });
    filePath = path.join(dir, filename);
    const nodeStream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream<Uint8Array>);
    await pipeline(nodeStream, createWriteStream(filePath));
  } catch (err) {
    console.error("Upload failed writing file to disk:", err);
    await markFailed(sessionId, "Upload failed on the server — please try again.");
    await rm(dir, { recursive: true, force: true });
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }

  // Defense-in-depth: confirm what actually landed on disk, in case
  // Content-Length was missing or understated.
  const { size: writtenSize } = await stat(filePath);
  if (writtenSize > MAX_SIZE_BYTES) {
    await markFailed(sessionId, MAX_SIZE_MESSAGE);
    await rm(dir, { recursive: true, force: true });
    return NextResponse.json({ error: MAX_SIZE_MESSAGE }, { status: 400 });
  }

  // Probe duration before charging anything — an unreadable/corrupt file
  // is a pre-charge failure, never falls through to charging a fallback
  // amount. Deliberately probes before uploading to B2 at all, so a
  // corrupt file never costs a wasted upload.
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

  const key = uploadKey(sessionId, filename);
  try {
    await putObjectStream(key, createReadStream(filePath), contentType);
  } catch (err) {
    console.error("Upload failed pushing file to B2:", err);
    await markFailed(sessionId, "Upload failed on the server — please try again.");
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  } finally {
    // Local copy was only ever needed for ffprobe — gone either way.
    await rm(dir, { recursive: true, force: true });
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
    await deleteObject(key);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await sendProcessSessionJob(sessionId);

    const { rows: smsRows } = await pool.query<{ phone: string | null; sms_opt_in: boolean }>(
      `SELECT phone, sms_opt_in FROM users WHERE id = $1`,
      [userId]
    );
    if (smsRows[0]?.sms_opt_in && smsRows[0].phone) {
      try {
        await sendUploadReceivedSms(smsRows[0].phone);
      } catch (smsErr) {
        // A failed notification shouldn't fail an otherwise-successful upload.
        console.error(`failed to send upload-received sms for session ${sessionId}:`, smsErr);
      }
    }

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
    await deleteObject(key);
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
