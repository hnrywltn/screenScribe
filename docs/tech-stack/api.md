# API

Route handlers under `app/api/`. Pages themselves (`app/(app)/dashboard/page.tsx`, `app/(app)/sessions/page.tsx`) still query Postgres directly via `lib/db.ts` in server components — the API layer exists for actions a client component needs to trigger (auth, upload, download), not for reads a server component can just do itself.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Create a user (email/password validated, hashed via `bcryptjs`), issue a session cookie |
| `/api/auth/login` | POST | Verify credentials, issue a session cookie. Generic "Invalid email or password" on any failure — no user-enumeration |
| `/api/auth/logout` | POST | Clear the session cookie |
| `/api/auth/verify` | GET | `?token=<jwt>`. **No auth check** — the token itself proves email ownership, someone might click it from a different browser. Sets `email_verified_at`, redirects to `/dashboard?verified=success` or `?verified=error` |
| `/api/auth/resend-verification` | POST | Auth-gated. Issues a fresh verification token, refuses if already verified |
| `/api/sessions` | POST | Upload a video. Auth-gated. Validates it's a video file under 2GB, creates a `sessions` row (`status = 'queued'`), writes the raw file to `SHARED_TEMP_DIR`, enqueues a `pg-boss` job. Buffers the whole file in memory before writing — not streamed, see `CLAUDE.md` → "Deliberately not built yet" |
| `/api/sessions/[id]/download` | GET | Auth-gated (must own the session). Atomically claims the session (`UPDATE ... WHERE status = 'complete' RETURNING id`) before touching the file — the real concurrency guard against a double-download race. Streams the zip once, deletes it, marks `downloaded`. Lazily flips overdue `complete` rows to `expired` and refuses instead of serving |
| `/api/admin/grant-tokens` | POST | **Admin-gated**, not just auth-gated — checks `users.is_admin` independently of whether the caller could see the nav link or the page. Body `{ userId, tokens }`, `tokens` must be a positive integer. Inserts a `token_grants` row (`source = 'admin_grant'`, `amount_cents = NULL`) and increments `users.token_balance` in one transaction |

No API versioning. All responses are JSON via `NextResponse.json()` except `/api/auth/verify` (redirect) and the download route (raw zip bytes, `Content-Type: application/zip`).

## Conventions

- Dynamic route params are `Promise`-typed and awaited (Next.js 16 convention): `{ params }: { params: Promise<{ id: string }> }`.
- No request validation library (no Zod) — bodies are read directly and checked by hand (email regex, password length, file type/size).
- Auth check is `getCurrentUserId()` (`lib/auth.ts`) at the top of each protected handler, not middleware — see [`architecture.md`](./architecture.md) → "Middleware". `/api/auth/verify` is the one deliberate exception — see its row above.
- **Route folder names starting with `_` don't route at all** — Next.js treats them as private folders, excluded from the router entirely. Learned the hard way building a temporary test-only route as `app/api/_test-only/...` (silent 404) before renaming it without the underscore.
