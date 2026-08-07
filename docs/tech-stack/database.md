# Database

- **Engine:** Postgres (local), database name `screenscribe`
- **Driver:** [`pg`](https://node-postgres.com/) (`node-postgres`), raw SQL — **no ORM**
- **Connection:** `lib/db.ts` — single `Pool` singleton, `connectionString` from `DATABASE_URL` in `.env.local`
- **Migrations:** no migration framework — `lib/migrate.ts` is one hand-written idempotent script (`CREATE TABLE IF NOT EXISTS`). Run with `npm run migrate`.
- **Seeding:** none yet — no `lib/seed.ts`.

## Tables

- `sessions` — one row per uploaded video: `id` (UUID PK), `name`, `original_filename`, `status` (`uploaded` / `transcoding` / `detecting_scenes` / `transcribing` / `packaging` / `complete` / `failed`), `video_key` (nullable — set once transcoding finishes), `error_message`, `created_at`/`updated_at`
- `screenshots` — one row per detected distinct slide/screen: `id` (UUID PK), `session_id` (FK → `sessions`, `ON DELETE CASCADE`), `image_key`, `timestamp_seconds`, `ordinal`, `created_at`. Indexed on `session_id`.
- `transcript_segments` — one row per Whisper transcript segment: `id` (UUID PK), `session_id` (FK → `sessions`, `ON DELETE CASCADE`), `start_seconds`, `end_seconds`, `text`, `ordinal`, `created_at`. Indexed on `session_id`.

## Notable patterns

- No row-level auth/permissions — single-user, no multi-tenancy, same as healthReference and patientRecordSystem at their equivalent early stage.
- `video_key`/`image_key` are plain `TEXT` — storage-agnostic, no assumption baked in about R2/B2/local disk (see [`architecture.md`](./architecture.md)).
- Nothing currently writes to these tables outside `lib/migrate.ts` — no upload/processing code exists yet, so in a fresh checkout all three tables are empty.
