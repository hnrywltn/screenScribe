import Stripe from "stripe";
import pool from "./db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
