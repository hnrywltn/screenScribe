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
    // StudyBeacon doesn't keep the uploaded video, extracted screenshots,
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

    // Pause/revoke (2026-08-14). Plain TEXT, no CHECK constraint — same
    // convention as sessions.status, enforced at the app layer
    // (app/api/admin/set-account-status/route.ts validates the value).
    // Values: 'active' / 'paused' / 'revoked'. This is checked LIVE on
    // every request (lib/auth.ts -> getCurrentUserId queries it, doesn't
    // just trust the session JWT) — that's what makes pausing/revoking
    // take effect immediately on an already-logged-in session, despite
    // sessions being stateless JWTs with no server-side store to
    // invalidate. See CLAUDE.md -> "Decided: account status".
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    `);

    // Real Stripe billing (2026-08-14). One Stripe Customer per user,
    // created lazily on first checkout attempt (lib/stripe.ts ->
    // getOrCreateStripeCustomer), not at signup — most users may never
    // pay. stripe_subscription_status mirrors Stripe's own
    // subscription.status values verbatim rather than inventing our own
    // enum, kept in sync by the webhook handler. cancel_at_period_end is
    // tracked separately because Stripe keeps status='active' through
    // the paid period even after a cancellation is requested — only
    // flipping to 'canceled' once the period actually ends.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL
    `);
    // Which Stripe object (PaymentIntent or Invoice id) produced this
    // grant, for support/debugging. Nullable — admin_grant rows have
    // nothing to point to.
    await client.query(`
      ALTER TABLE token_grants ADD COLUMN IF NOT EXISTS stripe_reference TEXT
    `);
    // Webhook idempotency: Stripe redelivers events on retry, and events
    // can be manually resent too. This is the claim table that makes
    // reprocessing a no-op — INSERT ... ON CONFLICT DO NOTHING against
    // event.id, the same atomic-guard idea as the download route's
    // claim-before-serve UPDATE, just via INSERT since there's no prior
    // row to conditionally update.
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        processed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Upload-time token enforcement (2026-08-14). Links a charge/refund
    // in token_grants back to the session that caused it — lets the
    // worker's refund-on-failure logic find "how much was this session
    // charged" without a separate sessions.tokens_charged column, and
    // keeps token_grants as the single source of truth for every
    // balance change (see CLAUDE.md -> "Decided: upload token
    // enforcement"). Nullable — most existing grants (purchases, admin
    // comps) have no session to point to.
    await client.query(`
      ALTER TABLE token_grants ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS token_grants_session_id_idx ON token_grants(session_id)
    `);

    // Paid expiry extension (2026-08-14) — capped at one use per
    // session (max 2 hours total: 1 free + 1 paid), enforced at the app
    // layer via an atomic UPDATE ... WHERE extended = FALSE, same "no
    // CHECK constraint" convention as sessions.status/account_status.
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS extended BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Rate limiting (2026-08-14) — Postgres-backed, not Redis, same
    // reasoning as choosing pg-boss over a new queue infra: reuse what's
    // already in the stack. A plain attempt log; isRateLimited() does a
    // windowed COUNT(*) against (key, action, created_at). Old rows are
    // pruned by the scheduled cleanup job (worker/index.ts), not left
    // to grow forever.
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS rate_limit_attempts_key_action_created_idx
        ON rate_limit_attempts(key, action, created_at)
    `);

    // Session invalidation on password change (2026-08-14). Nullable —
    // NULL means the password has never been reset since this column
    // existed, so no session should be rejected on that basis.
    // getCurrentUserId() compares a session JWT's own iat against this
    // to reject any session issued before the most recent reset — the
    // same live-invalidation trick account_status uses, since sessions
    // are stateless and otherwise unrelated to password_hash. See
    // CLAUDE.md -> "Decided: rate limiting & password reset".
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ
    `);

    // Sessions page shows how long a video actually took to process
    // (2026-08-19) — can't derive that from updated_at, which keeps
    // getting overwritten by every later status transition (complete ->
    // downloaded -> expired), so it can't be trusted to still hold the
    // "just finished processing" moment by the time someone looks at the
    // page. Both nullable — NULL until the corresponding transition
    // actually happens, and processing_started_at alone (no
    // processed_at yet) is exactly how the Sessions page tells "still
    // processing" from "processing took N time" apart.
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ
    `);

    // SMS notifications (2026-08-20) — opt-in only (TCPA requires
    // affirmative consent, unlike email). Defaults FALSE so an existing
    // row with a phone number already on file (collected before this
    // column existed) isn't silently treated as opted in. Only
    // meaningful when phone IS NOT NULL, but not enforced with a CHECK —
    // same "validate at the app layer" convention as account_status.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT FALSE
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
