export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

const INVALID_CREDENTIALS = { error: "Invalid email or password." };
const RATE_LIMITED = { error: "Too many attempts. Try again in a few minutes." };

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Checked before touching the users table at all — a rate-limited
  // request shouldn't even get as far as the SELECT below.
  if (await isRateLimited(email, "login", 5, 15)) {
    return NextResponse.json(RATE_LIMITED, { status: 429 });
  }

  const { rows } = await pool.query<{ id: string; password_hash: string; account_status: string }>(
    `SELECT id, password_hash, account_status FROM users WHERE email = $1`,
    [email]
  );

  // Same generic message whether the email doesn't exist or the password
  // is wrong — don't let a client distinguish the two (user enumeration).
  // An attempt is recorded on BOTH branches below for the same reason:
  // if only wrong-password attempts counted toward the limiter, an
  // attacker could tell a real email from a fake one just by watching
  // for the 429 (real emails would eventually rate-limit, fake ones
  // never would) — reopening exactly the hole this generic message
  // exists to close.
  if (rows.length === 0) {
    await recordAttempt(email, "login");
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const valid = await verifyPassword(password, rows[0].password_hash);
  if (!valid) {
    await recordAttempt(email, "login");
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
