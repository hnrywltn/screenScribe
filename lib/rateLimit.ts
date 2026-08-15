import pool from "./db";

// Postgres-backed, not Redis — same reasoning as choosing pg-boss over
// adding a new queue infra: reuse what's already in the stack. Old rows
// are pruned by the worker's scheduled cleanup job, not left to grow
// forever.

export async function isRateLimited(key: string, action: string, maxAttempts: number, windowMinutes: number): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM rate_limit_attempts WHERE key = $1 AND action = $2 AND created_at > NOW() - ($3 || ' minutes')::INTERVAL`,
    [key, action, windowMinutes]
  );
  return Number(rows[0].count) >= maxAttempts;
}

export async function recordAttempt(key: string, action: string): Promise<void> {
  await pool.query(`INSERT INTO rate_limit_attempts (key, action) VALUES ($1, $2)`, [key, action]);
}
