export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import pool from "@/lib/db";
import stripe from "@/lib/stripe";
import { sendReceiptEmail } from "@/lib/email";

const SUBSCRIPTION_TOKENS_PER_MONTH = 100;

// No getCurrentUserId() call here — Stripe isn't a logged-in user.
// Signature verification against the raw body is the only gate.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency claim happens INSIDE the same transaction as the
    // grant it guards, not before it — a mid-processing crash then
    // rolls back the claim too, so Stripe's automatic retry (it retries
    // non-2xx responses) can safely reprocess the same event later
    // instead of the event being stuck "claimed" with no grant applied.
    const claim = await client.query(
      `INSERT INTO stripe_webhook_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type]
    );
    if (claim.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Captured during the grant below, sent only after COMMIT succeeds —
    // a failed receipt email should never roll back a real token grant.
    let receipt: { to: string; tokens: number; amountCents: number; kind: "pack" | "subscription" } | null = null;

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // A subscription's first invoice also has an underlying
        // PaymentIntent that fires this same event type, with no
        // source metadata — only invoice.paid (below) should grant
        // subscription tokens. Without this guard, the first
        // subscription payment would double-grant tokens.
        if (pi.metadata?.source !== "token_pack") break;

        const userId = pi.metadata.userId;
        const tokens = Number(pi.metadata.tokens);
        if (!userId || !Number.isInteger(tokens) || tokens <= 0) break;

        await client.query(
          `INSERT INTO token_grants (user_id, tokens, amount_cents, source, stripe_reference) VALUES ($1, $2, $3, 'pay_as_you_go', $4)`,
          [userId, tokens, pi.amount, pi.id]
        );
        const { rows: piRows } = await client.query<{ email: string }>(
          `UPDATE users SET token_balance = token_balance + $2 WHERE id = $1 RETURNING email`,
          [userId, tokens]
        );
        if (piRows[0]) {
          receipt = { to: piRows[0].email, tokens, amountCents: pi.amount, kind: "pack" };
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        if (!subscriptionRef) break; // not a subscription invoice

        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const priceRef = invoice.lines.data[0]?.pricing?.price_details?.price;
        const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
        if (priceId !== process.env.STRIPE_SUBSCRIPTION_PRICE_ID) break; // future-proofing against a second price

        const { rows } = await client.query<{ id: string; email: string }>(
          `SELECT id, email FROM users WHERE stripe_customer_id = $1`,
          [customerId]
        );
        if (rows.length === 0) break;
        const userId = rows[0].id;

        await client.query(
          `INSERT INTO token_grants (user_id, tokens, amount_cents, source, stripe_reference) VALUES ($1, $2, $3, 'subscription', $4)`,
          [userId, SUBSCRIPTION_TOKENS_PER_MONTH, invoice.amount_paid, invoice.id]
        );
        await client.query(`UPDATE users SET token_balance = token_balance + $2, stripe_subscription_status = 'active' WHERE id = $1`, [
          userId,
          SUBSCRIPTION_TOKENS_PER_MONTH,
        ]);
        receipt = {
          to: rows[0].email,
          tokens: SUBSCRIPTION_TOKENS_PER_MONTH,
          amountCents: invoice.amount_paid,
          kind: "subscription",
        };
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        await client.query(
          `UPDATE users SET stripe_subscription_status = $2, stripe_cancel_at_period_end = $3 WHERE stripe_customer_id = $1`,
          [customerId, sub.status, sub.cancel_at_period_end]
        );
        break;
      }

      default:
        break;
    }

    await client.query("COMMIT");

    if (receipt) {
      // Best-effort — a failed receipt email shouldn't turn into a 500
      // that makes Stripe retry a webhook whose grant already committed.
      try {
        await sendReceiptEmail(receipt.to, receipt);
      } catch (err) {
        console.error("failed to send receipt email:", err);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Stripe webhook processing failed", event.type, event.id, err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 }); // Stripe retries
  } finally {
    client.release();
  }
}
