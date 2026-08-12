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
