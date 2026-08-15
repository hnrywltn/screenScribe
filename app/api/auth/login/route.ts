export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

const INVALID_CREDENTIALS = { error: "Invalid email or password." };

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const { rows } = await pool.query<{ id: string; password_hash: string; account_status: string }>(
    `SELECT id, password_hash, account_status FROM users WHERE email = $1`,
    [email]
  );

  // Same generic message whether the email doesn't exist or the password
  // is wrong — don't let a client distinguish the two (user enumeration).
  if (rows.length === 0) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const valid = await verifyPassword(password, rows[0].password_hash);
  if (!valid) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  // Checked only *after* the password is confirmed correct — revealing
  // "this account is paused" to someone who doesn't actually know the
  // password would be its own small user-enumeration/status leak.
  if (rows[0].account_status !== "active") {
    const message =
      rows[0].account_status === "paused"
        ? "Your account has been paused. Contact support for help."
        : "Your account has been revoked.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  await createSession(rows[0].id);
  return NextResponse.json({ ok: true });
}
