# API

Route handlers under `app/api/`. Pages themselves (`app/(app)/dashboard/page.tsx`, `app/(app)/sessions/page.tsx`) still query Postgres directly via `lib/db.ts` in server components — the API layer exists for actions a client component needs to trigger (auth, upload, download), not for reads a server component can just do itself.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Create a user (email/password validated, hashed via `bcryptjs`), issue a session cookie |
| `/api/auth/login` | POST | Verify credentials, issue a session cookie. Generic "Invalid email or password" on any failure — no user-enumeration |
| `/api/auth/logout` | POST | Clear the session cookie |
| `/api/sessions` | POST | Upload a video. Auth-gated. Validates it's a video file under 2GB, creates a `sessions` row (`status = 'queued'`), writes the raw file to `SHARED_TEMP_DIR`, enqueues a `pg-boss` job. Buffers the whole file in memory before writing — not streamed, see `CLAUDE.md` → "Deliberately not built yet" |
| `/api/sessions/[id]/download` | GET | Auth-gated (must own the session). Atomically claims the session (`UPDATE ... WHERE status = 'complete' RETURNING id`) before touching the file — the real concurrency guard against a double-download race. Streams the zip once, deletes it, marks `downloaded`. Lazily flips overdue `complete` rows to `expired` and refuses instead of serving |

No API versioning. All responses are JSON via `NextResponse.json()` except the download route, which returns the raw zip bytes with `Content-Type: application/zip`.

## Conventions

- Dynamic route params are `Promise`-typed and awaited (Next.js 16 convention): `{ params }: { params: Promise<{ id: string }> }`.
- No request validation library (no Zod) — bodies are read directly and checked by hand (email regex, password length, file type/size).
- Auth check is `getCurrentUserId()` (`lib/auth.ts`) at the top of each protected handler, not middleware — see [`architecture.md`](./architecture.md) → "Middleware".
