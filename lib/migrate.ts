import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // One row per uploaded video. `status` tracks its position in the
    // pipeline (upload -> transcode -> scene detection -> transcription ->
    // packaging). `video_key` is the storage key/path for the transcoded
    // mp4 once transcoding finishes — storage backend not decided yet, see
    // CLAUDE.md.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'uploaded',
        video_key TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // One row per detected distinct slide/screen. `ordinal` is the
    // slide's position in the session (1, 2, 3...); `timestamp_seconds` is
    // where in the video it was captured.
    await client.query(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        image_key TEXT NOT NULL,
        timestamp_seconds NUMERIC NOT NULL,
        ordinal INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS screenshots_session_id_idx ON screenshots(session_id)
    `);

    // One row per Whisper transcript segment, timestamp-aligned to the
    // video so a full transcript.txt (or .srt/.vtt) can be reconstructed
    // at download time.
    await client.query(`
      CREATE TABLE IF NOT EXISTS transcript_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        start_seconds NUMERIC NOT NULL,
        end_seconds NUMERIC NOT NULL,
        text TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transcript_segments_session_id_idx ON transcript_segments(session_id)
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
