import type { PoolClient } from "pg";

/**
 * Debits `cost` tokens from a user's balance, allowing the balance to go
 * as low as -100 (a shortage shouldn't block usage outright — it's paid
 * off automatically by the user's next purchase) but no further.
 *
 * Takes the caller's own transaction client — the conditional UPDATE and
 * the ledger INSERT must commit or roll back together. Returns the new
 * balance, or null if even the -100 floor would be exceeded.
 */
export async function chargeTokens(
  client: PoolClient,
  userId: string,
  cost: number,
  source: "usage_upload" | "usage_extend",
  sessionId: string
): Promise<number | null> {
  const { rows } = await client.query<{ token_balance: number }>(
    `UPDATE users SET token_balance = token_balance - $2
     WHERE id = $1 AND token_balance - $2 >= -100
     RETURNING token_balance`,
    [userId, cost]
  );
  if (rows.length === 0) return null;

  await client.query(
    `INSERT INTO token_grants (user_id, tokens, amount_cents, source, session_id) VALUES ($1, $2, NULL, $3, $4)`,
    [userId, -cost, source, sessionId]
  );

  return rows[0].token_balance;
}

/**
 * Refunds the 'usage_upload' charge for a session, if one exists and
 * hasn't already been refunded. Idempotency-guarded (checks for an
 * existing 'refund' row for this session_id first) so it's safe to call
 * from multiple failure paths — a retried job, or a failure between
 * charging and enqueueing — without double-crediting the user.
 */
export async function refundUsageCharge(client: PoolClient, sessionId: string): Promise<void> {
  const { rows: charges } = await client.query<{ user_id: string; tokens: number }>(
    `SELECT user_id, tokens FROM token_grants WHERE session_id = $1 AND source = 'usage_upload'`,
    [sessionId]
  );
  if (charges.length === 0) return;

  const { rows: existingRefunds } = await client.query(
    `SELECT 1 FROM token_grants WHERE session_id = $1 AND source = 'refund'`,
    [sessionId]
  );
  if (existingRefunds.length > 0) return;

  const { user_id: userId, tokens: chargedTokens } = charges[0];
  const refundAmount = -chargedTokens; // the charge was stored negative

  await client.query(
    `INSERT INTO token_grants (user_id, tokens, amount_cents, source, session_id, note) VALUES ($1, $2, NULL, 'refund', $3, 'Processing failed')`,
    [userId, refundAmount, sessionId]
  );
  await client.query(`UPDATE users SET token_balance = token_balance + $2 WHERE id = $1`, [userId, refundAmount]);
}
