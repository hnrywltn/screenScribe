export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { sendProcessSessionJob } from "@/lib/queue";
import { uploadDir } from "@/lib/tempStorage";

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB, matches UploadDropzone's client-side check

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

  try {
    const dir = uploadDir(sessionId);
    await mkdir(dir, { recursive: true });
    // Buffers the whole file in memory before writing — fine at this
    // scale/stage, but a real memory-pressure concern for large uploads
    // under real concurrent traffic. Streaming straight to disk would
    // avoid it; not built, see docs/tech-stack/architecture.md.
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, file.name), buffer);

    await sendProcessSessionJob(sessionId);

    return NextResponse.json({ ok: true, sessionId });
  } catch (err) {
    console.error("Upload failed after session row was created:", err);
    await pool.query(
      `UPDATE sessions SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [sessionId, "Upload failed on the server — please try again."]
    );
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
