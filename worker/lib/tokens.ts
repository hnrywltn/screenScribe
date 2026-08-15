import type { PoolClient } from "pg";

// Deliberate duplicate of lib/tokens.ts's refundUsageCharge — separate
// npm packages, same pattern already used for email.ts/tempStorage.ts.
// The worker never charges tokens (only the upload/extend routes do),
// so only the refund half is needed here.
//
// Idempotency-guarded: checks for an existing 'refund' row before
// crediting, so it's safe to call on every job failure even if pg-boss
// retries the same job — without this guard, a retried failure would
// refund the same charge twice.
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
  const refundAmount = -chargedTokens;

  await client.query(
    `INSERT INTO token_grants (user_id, tokens, amount_cents, source, session_id, note) VALUES ($1, $2, NULL, 'refund', $3, 'Processing failed')`,
    [userId, refundAmount, sessionId]
  );
  await client.query(`UPDATE users SET token_balance = token_balance + $2 WHERE id = $1`, [userId, refundAmount]);
}
