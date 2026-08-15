export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import stripe from "@/lib/stripe";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows } = await pool.query<{ stripe_subscription_id: string | null }>(
    `SELECT stripe_subscription_id FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows[0]?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription." }, { status: 400 });
  }

  // Graceful cancellation — keeps access through the already-paid
  // period. The DB isn't updated optimistically here; the
  // customer.subscription.updated webhook is the single source of
  // truth for stripe_subscription_status/stripe_cancel_at_period_end,
  // same "don't trust the edge that triggered it" pattern as
  // account_status.
  await stripe.subscriptions.update(rows[0].stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ ok: true });
}
