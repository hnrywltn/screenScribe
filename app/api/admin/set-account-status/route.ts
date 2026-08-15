export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

const VALID_STATUSES = ["active", "paused", "revoked"];

export async function POST(request: Request) {
  const adminId = await getCurrentUserId();
  if (!adminId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows: adminRows } = await pool.query<{ is_admin: boolean }>(`SELECT is_admin FROM users WHERE id = $1`, [
    adminId,
  ]);
  if (!adminRows[0]?.is_admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const targetUserId = typeof body.userId === "string" ? body.userId : "";
  const status = typeof body.status === "string" ? body.status : "";

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  // Guard against accidental self-lockout — an admin pausing/revoking
  // their own account would need a different admin to undo it.
  if (targetUserId === adminId) {
    return NextResponse.json({ error: "You can't change your own account status." }, { status: 400 });
  }

  const { rows } = await pool.query(`UPDATE users SET account_status = $2 WHERE id = $1 RETURNING id`, [
    targetUserId,
    status,
  ]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
