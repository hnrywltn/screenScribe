export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// Used only by components/UploadProvider.tsx's grace-check after a
// client-side network error on the upload request — see its comment for
// why. Not a general-purpose sessions API; deliberately returns just the
// single most recent row, nothing else needs this shape.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows } = await pool.query<{ id: string; status: string; created_at: string }>(
    `SELECT id, status, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ session: null });
  }
  const { id, status, created_at } = rows[0];
  return NextResponse.json({ session: { id, status, createdAt: created_at } });
}
