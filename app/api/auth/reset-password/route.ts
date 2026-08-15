export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { hashPassword, verifyPasswordResetToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const userId = await verifyPasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const { rows } = await pool.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);

  // Someone who just proved account ownership via email shouldn't still
  // be locked out of login from their own earlier failed attempts.
  await pool.query(`DELETE FROM rate_limit_attempts WHERE key = $1 AND action = 'login'`, [rows[0].email]);

  return NextResponse.json({ ok: true });
}
