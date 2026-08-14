export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyVerificationToken } from "@/lib/auth";

// No auth check here on purpose — the token itself (proof of email
// ownership) is the authorization. Someone could click this link from a
// different browser/device than they signed up on.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const userId = token ? await verifyVerificationToken(token) : null;
  if (!userId) {
    return NextResponse.redirect(new URL("/dashboard?verified=error", request.url));
  }

  await pool.query(`UPDATE users SET email_verified_at = NOW() WHERE id = $1 AND email_verified_at IS NULL`, [
    userId,
  ]);

  return NextResponse.redirect(new URL("/dashboard?verified=success", request.url));
}
