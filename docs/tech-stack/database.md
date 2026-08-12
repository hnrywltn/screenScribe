# Database

- **Engine:** Postgres (local), database name `screenscribe`
- **Driver:** [`pg`](https://node-postgres.com/) (`node-postgres`), raw SQL — **no ORM**
- **Connection:** `lib/db.ts` — single `Pool` singleton, `connectionString` from `DATABASE_URL` in `.env.local`
- **Migrations:** no migration framework — `lib/migrate.ts` is one hand-written idempotent script (`CREATE TABLE IF NOT EXISTS`). Run with `npm run migrate`.
- **Seeding:** `lib/seed.ts`, run with `npm run seed`. Dev-only: upserts one known user (`dev@screenscribe.test` / `devpassword123`, hashed via `bcryptjs` directly — deliberately doesn't import `lib/auth.ts`, since that file also exports session helpers that touch `next/headers`, which isn't safe to import outside a Next.js request context). Idempotent — re-running just resets the password.

## Tables

Just two — deliberately thin. See `CLAUDE.md` → "Decided: storage & retention": nothing about a processed video persists, so there's no media table to design.

- `users` — `id` (UUID PK), `email` (unique), `password_hash`, `created_at`. Written to by `app/api/auth/signup/route.ts`, read by `app/api/auth/login/route.ts` — email+password auth is built, see `CLAUDE.md` → "Decided: auth mechanism".
- `sessions` — a **usage log**, not a record of output: `id` (UUID PK), `user_id` (FK → `users`, `ON DELETE CASCADE`, `NOT NULL`), `original_filename`, `status` (`processing` / `complete` / `failed`), `error_message`, `created_at`/`updated_at`. Indexed on `user_id`. No `video_key`/`image_key`/anything pointing at stored content.

## Notable patterns

- `users.email` has a `UNIQUE` constraint that's actually relied on — the signup route inserts directly and catches Postgres error `23505` (unique_violation) rather than doing a pre-check `SELECT` first, which would leave a race window between the check and the insert.
- No row-level auth/permissions enforced yet on `sessions` — `user_id` is `NOT NULL` and auth now exists to populate it, but nothing does: no upload flow creates session rows yet, so the column is correct but unused. `app/(app)/sessions/page.tsx` queries all sessions unfiltered.
- **Previously had `screenshots` and `transcript_segments` tables** (one row per detected slide, one per transcript segment) — removed 2026-08-12 when the storage model changed from "keep the output, let users re-download" to "one-time download, nothing kept." Pre-launch with no real data in either table, so `lib/migrate.ts` was rewritten directly rather than layering `DROP TABLE` statements on top of the old shape — see `docs/changelogs/2026-08-12.md`.
- Nothing currently writes to either table outside `lib/migrate.ts` — no signup or upload code exists yet, so in a fresh checkout both tables are empty.
