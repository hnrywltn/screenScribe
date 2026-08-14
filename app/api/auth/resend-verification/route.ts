export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId, createVerificationToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows } = await pool.query<{ email: string; email_verified_at: string | null }>(
    `SELECT email, email_verified_at FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (rows[0].email_verified_at) {
    return NextResponse.json({ error: "Already verified." }, { status: 400 });
  }

  const token = await createVerificationToken(userId);
  await sendVerificationEmail(rows[0].email, token);

  return NextResponse.json({ ok: true });
}
