export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { downloadZipKey, headObject, getObjectStream, deleteObject } from "@/lib/b2";

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
    await deleteObject(downloadZipKey(id));
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

  const zipKey = downloadZipKey(id);
  let fileSize: number;
  try {
    fileSize = (await headObject(zipKey)).contentLength;
  } catch (err) {
    console.error(`download claimed but object missing for session ${id}:`, err);
    return NextResponse.json(
      { error: "Something went wrong — the file is missing. Please re-upload." },
      { status: 500 }
    );
  }

  // Streamed, not buffered into memory — a multi-hundred-MB zip no
  // longer has to be held whole in server memory to serve it. Deletes
  // the B2 object right after opening the stream, same "one-time
  // download" pattern as the old local-disk version. Confirmed for real
  // against B2 (not just assumed from S3 docs): downloaded a real
  // processed zip, the Content-Length matched exactly, unzip -t passed
  // with all files intact, and the object was already gone from the
  // bucket by the time the response completed — a DELETE issued right
  // after opening the GET does not truncate the in-flight stream.
  const nodeStream = await getObjectStream(zipKey);
  await deleteObject(zipKey);

  const safeName = session.original_filename.replace(/[^\w.\- ]/g, "_");
  return new NextResponse(Readable.toWeb(nodeStream as Readable) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
      "Content-Length": String(fileSize),
    },
  });
}
