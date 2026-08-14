export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readFile, rm } from "node:fs/promises";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { downloadZipPath } from "@/lib/tempStorage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows } = await pool.query<{
    status: string;
    expires_at: string | null;
    original_filename: string;
  }>(`SELECT status, expires_at, original_filename FROM sessions WHERE id = $1 AND user_id = $2`, [id, userId]);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const session = rows[0];

  if (session.status === "queued" || session.status === "processing") {
    return NextResponse.json({ error: "Still processing — check back shortly." }, { status: 425 });
  }
  if (session.status === "failed") {
    return NextResponse.json({ error: "Processing failed for this session." }, { status: 400 });
  }
  if (session.status === "downloaded") {
    return NextResponse.json({ error: "This download has already been used." }, { status: 410 });
  }
  if (session.status === "expired" || (session.expires_at && new Date(session.expires_at) < new Date())) {
    // Lazily flip to expired if the 1-hour window passed but nothing's
    // swept it yet — no periodic cleanup job exists, this is the only
    // place expiry actually gets enforced right now.
    await pool.query(`UPDATE sessions SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'complete'`, [
      id,
    ]);
    await rm(downloadZipPath(id), { force: true });
    return NextResponse.json({ error: "This download has expired." }, { status: 410 });
  }

  // Atomically claim it — the WHERE clause is the real concurrency guard
  // against two simultaneous requests both trying to serve (and delete)
  // the same file.
  const claim = await pool.query(
    `UPDATE sessions SET status = 'downloaded', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'complete'
     RETURNING id`,
    [id, userId]
  );
  if (claim.rows.length === 0) {
    return NextResponse.json({ error: "This download has already been used." }, { status: 410 });
  }

  const zipPath = downloadZipPath(id);
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(zipPath);
  } catch (err) {
    console.error(`download claimed but file missing for session ${id}:`, err);
    return NextResponse.json(
      { error: "Something went wrong — the file is missing. Please re-upload." },
      { status: 500 }
    );
  }

  await rm(zipPath, { force: true });

  const safeName = session.original_filename.replace(/[^\w.\- ]/g, "_");
  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  });
}
