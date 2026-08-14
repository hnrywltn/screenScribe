export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { hashPassword, createSession, createVerificationToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, passwordHash]
    );
    await createSession(rows[0].id);

    // Soft verification — signup still succeeds and logs the user in
    // even if this fails. A missing/failed verification email just means
    // the banner (components/VerifyEmailBanner.tsx) sticks around and
    // they can request a resend.
    try {
      const token = await createVerificationToken(rows[0].id);
      await sendVerificationEmail(email, token);
    } catch (err) {
      console.error("failed to send verification email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Postgres unique_violation on users.email — race-safe, this is the
    // real guard, not a pre-check SELECT (which would have a TOCTOU gap).
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    throw err;
  }
}
