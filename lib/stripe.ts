import Stripe from "stripe";
import pool from "./db";

// The Stripe SDK throws synchronously in its constructor if apiKey is
// falsy — unlike lib/db.ts's Pool, which tolerates an undefined
// connectionString at construction. That matters because `next build`
// evaluates route modules (including their imports' top-level code) to
// collect config, even for routes that are otherwise fully dynamic —
// so a missing STRIPE_SECRET_KEY at *build* time (not just runtime)
// used to crash the whole build. The placeholder is never actually
// used to make a request; only real requests at runtime, when the real
// env var is present, call this client.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_build_placeholder");

export default stripe;

// One Stripe Customer per user, created lazily on first checkout
// attempt rather than at signup — most users may never pay.
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const { rows } = await pool.query<{ stripe_customer_id: string | null; email: string }>(
    `SELECT stripe_customer_id, email FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) {
    throw new Error("User not found.");
  }
  if (rows[0].stripe_customer_id) {
    return rows[0].stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: rows[0].email,
    metadata: { userId },
  });

  await pool.query(`UPDATE users SET stripe_customer_id = $2 WHERE id = $1`, [userId, customer.id]);

  return customer.id;
}
