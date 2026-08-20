export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json();
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const smsOptInRaw = body.smsOptIn === true;

  // Same loose validation as signup — 7-15 digits once punctuation is
  // stripped, matching E.164's max length, since phone formats vary too
  // widely to assume one country.
  let phone: string | null = null;
  if (phoneRaw.length > 0) {
    const digitCount = phoneRaw.replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) {
      return NextResponse.json({ error: "Enter a valid phone number, or leave it blank." }, { status: 400 });
    }
    phone = phoneRaw;
  }
  // Consent only means something if there's a number to text — same
  // guard as signup (app/api/auth/signup/route.ts).
  const smsOptIn = smsOptInRaw && phone !== null;

  await pool.query(`UPDATE users SET phone = $2, sms_opt_in = $3 WHERE id = $1`, [userId, phone, smsOptIn]);

  return NextResponse.json({ ok: true });
}
