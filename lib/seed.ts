import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Dev-only seed data — NOT for production. Gives a known set of
// credentials to log in with locally (via the real /login form) instead
// of signing up fresh every time the local DB gets reset. Safe to
// re-run: upserts on email, so it just resets the password each time.
const DEV_EMAIL = "dev@screenscribe.test";
const DEV_PASSWORD = "devpassword123";

// Fake demo "customers" purely so the admin dashboard has real (if
// seeded) data to show instead of an empty/placeholder state — see
// CLAUDE.md -> "Decided: admin dashboard". No actual payment processor
// is connected; `amount_cents` here is invented, not collected from
// anyone. Clearly fake test data, same spirit as the dev login above.
const DEMO_PASSWORD = "demopassword123";
const DEMO_USERS: {
  email: string;
  grants: { tokens: number; amountCents: number | null; source: string; note?: string }[];
}[] = [
  {
    email: "alice@example.com",
    grants: [{ tokens: 100, amountCents: 1500, source: "subscription", note: "Monthly plan" }],
  },
  {
    email: "bob@example.com",
    grants: [
      { tokens: 30, amountCents: 600, source: "pay_as_you_go" },
      { tokens: 15, amountCents: 300, source: "pay_as_you_go" },
    ],
  },
  {
    email: "carol@example.com",
    grants: [{ tokens: 50, amountCents: null, source: "admin_grant", note: "Beta tester comp" }],
  },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const devPasswordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  // Pre-verified and pre-admin — dev@screenscribe.test is a non-routable
  // .test address that could never receive a real verification email,
  // and is the account used for the pre-filled local-dev login, so it's
  // the natural one to also see the admin dashboard without needing to
  // log in as the real admin account.
  await pool.query(
    `INSERT INTO users (email, password_hash, email_verified_at, is_admin)
     VALUES ($1, $2, NOW(), TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, email_verified_at = NOW(), is_admin = TRUE`,
    [DEV_EMAIL, devPasswordHash]
  );
  console.log(`Seeded dev user (admin) — log in with:\n  email:    ${DEV_EMAIL}\n  password: ${DEV_PASSWORD}`);

  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const demo of DEMO_USERS) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, email_verified_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [demo.email, demoPasswordHash]
    );
    const userId = rows[0].id;

    // Re-seedable: wipe this user's grants and recompute rather than
    // accumulating duplicates on every `npm run seed`.
    await pool.query(`DELETE FROM token_grants WHERE user_id = $1`, [userId]);

    let totalTokens = 0;
    for (const grant of demo.grants) {
      await pool.query(
        `INSERT INTO token_grants (user_id, tokens, amount_cents, source, note) VALUES ($1, $2, $3, $4, $5)`,
        [userId, grant.tokens, grant.amountCents, grant.source, grant.note ?? null]
      );
      totalTokens += grant.tokens;
    }

    await pool.query(`UPDATE users SET token_balance = $2 WHERE id = $1`, [userId, totalTokens]);
  }
  console.log(`Seeded ${DEMO_USERS.length} demo customers with token_grants (password for all: ${DEMO_PASSWORD})`);

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
