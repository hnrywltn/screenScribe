import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Auth: email + password. No third-party identity provider — keeps
    // user data (and everything they process) off outside services.
    // Login/signup flow and session/cookie handling aren't built yet,
    // just the table — see CLAUDE.md.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Deliberately NOT a record of what was processed — just a usage log.
    // ScreenScribe doesn't keep the uploaded video, extracted screenshots,
    // or transcript once the zip has been streamed back to the user
    // (ephemeral temp dir, deleted after the response finishes), so
    // there's nothing here to re-download and no video_key/image_key
    // columns. `original_filename` and `status` exist for the user's own
    // history view and as a lightweight usage/billing record, not to
    // reconstruct the output.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_filename TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)
    `);

    // Upload flow landed (2026-08-14): sessions now go through a real
    // lifecycle (queued -> processing -> complete -> downloaded, or ->
    // expired/failed) instead of just "processing"/"complete"/"failed".
    // `expires_at` is the actual 1-hour download window a finished zip
    // stays available for before it's deleted — see CLAUDE.md -> "Decided:
    // notifications & download window". First real ALTER on this table
    // (real user accounts exist now) rather than a from-scratch rewrite.
    await client.query(`
      ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'queued'
    `);
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    `);

    // Email verification (2026-08-14) — soft/non-blocking: signup still
    // logs the user in immediately, this just tracks whether they've
    // confirmed the address, for a reminder banner. NULL = unverified.
    // No separate token table — verification tokens are short-lived JWTs
    // (lib/auth.ts), not stored server-side at all.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ
    `);

    // Phone number (2026-08-14) — optional, not required. Collecting it
    // as mandatory would sit oddly against the "extra private" pitch on
    // the marketing page; nothing currently uses it (no SMS notifications
    // built), it's just captured for future contact if given.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT
    `);

    // Admin dashboard (2026-08-14). `is_admin` gates the whole /admin
    // area — single boolean, not a roles/permissions system, since
    // there's exactly one admin persona right now (the operator), not a
    // team with different access levels to model.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // Running balance. Nothing deducts from it yet — upload metering
    // against token_balance isn't built (see CLAUDE.md), so today this
    // is purely a number an admin can see and add to, not something
    // that gates anything.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_balance INTEGER NOT NULL DEFAULT 0
    `);
    // The ledger: every time tokens are added to a balance, whether by
    // an admin manually granting them or (once billing is real) by an
    // actual purchase. `amount_cents` is set for a real/seeded purchase,
    // NULL for a pure comp/admin grant — that distinction is what lets
    // the admin page's revenue total mean something real rather than
    // just summing all token activity regardless of whether money
    // changed hands.
    await client.query(`
      CREATE TABLE IF NOT EXISTS token_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tokens INTEGER NOT NULL,
        amount_cents INTEGER,
        source TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS token_grants_user_id_idx ON token_grants(user_id)
    `);

    // Name (2026-08-14). Nullable at the DB level — existing accounts
    // predate this field and there's no real name to backfill them with
    // (guessing would be worse than leaving it blank) — but required at
    // the application level (app/api/auth/signup/route.ts) for every new
    // signup going forward. Same "nullable column, enforced by the form"
    // shape as adding any required field to a table that already has
    // real rows.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT
    `);

    await client.query("COMMIT");
    console.log("Migration complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
