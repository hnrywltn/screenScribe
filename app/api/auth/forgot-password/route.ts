export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (await isRateLimited(email, "forgot-password", 5, 15)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  await recordAttempt(email, "forgot-password");

  // Always the same response regardless of whether the email exists —
  // same user-enumeration-avoidance principle as login's generic error.
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (rows.length > 0) {
    try {
      const token = await createPasswordResetToken(rows[0].id);
      await sendPasswordResetEmail(email, token);
    } catch (err) {
      console.error("failed to send password reset email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
