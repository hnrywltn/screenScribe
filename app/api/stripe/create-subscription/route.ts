export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import stripe, { getOrCreateStripeCustomer } from "@/lib/stripe";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows } = await pool.query<{ stripe_subscription_status: string | null }>(
    `SELECT stripe_subscription_status FROM users WHERE id = $1`,
    [userId]
  );
  if (rows[0]?.stripe_subscription_status && ACTIVE_STATUSES.includes(rows[0].stripe_subscription_status)) {
    return NextResponse.json({ error: "Already subscribed." }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID! }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { userId },
  });

  await pool.query(
    `UPDATE users SET stripe_subscription_id = $2, stripe_subscription_status = $3, stripe_cancel_at_period_end = FALSE WHERE id = $1`,
    [userId, subscription.id, subscription.status]
  );

  // As of Stripe's 2025+ API versions, an invoice's payment client secret
  // comes from confirmation_secret, not the older expanded payment_intent
  // field — invoice.payment_intent no longer exists on this API version.
  const invoice = subscription.latest_invoice;
  const clientSecret = invoice && typeof invoice !== "string" ? invoice.confirmation_secret?.client_secret : null;

  if (!clientSecret) {
    return NextResponse.json({ error: "Could not start subscription checkout." }, { status: 500 });
  }

  return NextResponse.json({ clientSecret });
}
