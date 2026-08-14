# Architecture

## Framework

- **Next.js 16** (App Router), TypeScript, React 19
- `app/` — two route groups (see "Routing" below) plus `app/api/auth/` route handlers
- `lib/` — shared server code (`db.ts`, `migrate.ts`, `auth.ts`)
- `components/` — UI components

## Routing: `(marketing)` vs. `(app)` route groups

- **`app/(marketing)/`** — public, no `Sidebar`: hero/pricing page at `/`, `login/`, `signup/`. Layout shows "Log in"/"Get Started" or a "Dashboard" link depending on session state (read-only check, no redirect).
- **`app/(app)/`** — `dashboard/`, `sessions/`, `upload/`. Layout renders `Sidebar` and is the auth gate: redirects to `/login` if `getCurrentUserId()` returns `null`. Route groups don't affect URLs — `/dashboard` is still `/dashboard`.
- Root `app/layout.tsx` is minimal (`<html>`/`<body>`/font only) — `Sidebar` lives in `(app)/layout.tsx`, not the root, since marketing pages don't have it.

## Worker package (`worker/`)

A **separate npm package**, not part of the Next.js app — own `package.json`, `tsconfig.json`, `.env.local`, `node_modules`. Root `tsconfig.json` (`exclude: ["node_modules", "worker"]`) and `eslint.config.mjs` (`globalIgnores: [..., "worker/**"]`) both explicitly exclude it, so `npx tsc --noEmit`/`npx eslint .` run from the repo root never touch it and vice versa — the two packages have diverging dependency versions (e.g. root's `@types/node ^20` vs. the worker's `^26`) and shouldn't be typechecked as one program. Run its own checks from inside `worker/`. See "The processing pipeline" below for what it does.

## ORM

**None.** Database access is raw SQL via the `pg` driver (`lib/db.ts`), matching healthReference and patientRecordSystem. See [`database.md`](./database.md).

## Middleware

**None.** No `middleware.ts` — auth gating is done in `app/(app)/layout.tsx` (a server component, `redirect()` if unauthenticated) rather than middleware, keeping this consistent with healthReference/patientRecordSystem instead of introducing a new architectural layer for it.

## Auth — built

Email + password. `lib/auth.ts`: `bcryptjs` for hashing (12 rounds), `jose` for a signed HS256 JWT in an httpOnly cookie (`SESSION_SECRET` in `.env.local`, 30-day expiry). `app/api/auth/{signup,login,logout}/route.ts` handle the three actions; `LoginForm`/`SignupForm` client components post to them. Verified end-to-end with a real browser session (signup → dashboard → logout → gated again, duplicate-email and wrong-password error paths, already-authenticated redirect away from `/login`/`/signup`). See `CLAUDE.md` → "Decided: auth mechanism" for what's still missing (password reset, email verification, rate limiting — none built).

## The processing pipeline — working end to end, minus transcription

- **Upload — built.** `components/UploadDropzone.tsx` (drag-and-drop or click-to-browse, client-side type/size check, `XMLHttpRequest` for real upload-progress events) → `POST /api/sessions` (server-side re-validation, creates a `sessions` row, writes the file to `SHARED_TEMP_DIR`, enqueues a `pg-boss` job).
- **Transcode — built and verified.** `ffmpeg` (v9.0, Homebrew locally — **not yet set up on the worker's eventual Railway build**) via `worker/lib/ffmpeg.ts` → `transcodeToMp4()`. `libx264`/`aac`/`+faststart`, software encoding chosen over Apple's `videotoolbox` so behavior matches the Linux worker in production. Now actually called from the real job handler, not just tested in isolation.
- **Scene/slide detection — built and verified.** `worker/lib/ffmpeg.ts` → `extractSceneFrames()`. ffmpeg's own scene-change score, no new dependency. `threshold` still **not tuned against a real slide-deck recording**. Now actually called from the real job handler.
- **Transcription — the one real gap.** Direction and model size decided (local **whisper.cpp**, `medium`, quantized — see `CLAUDE.md` → "Decided: transcription"), **but not installed, not invoked**. The worker writes an honest placeholder `transcript.txt` instead of pretending transcription happened.
- **Packaging — built.** `worker/index.ts` zips `video.mp4` + `screenshots/*.png` + `transcript.txt` with `archiver` (`ZipArchive`, streamed to disk, not buffered in memory).
- **Job orchestration — built.** `pg-boss` queue, worker's `process-session` handler does the real work described above end to end (mark processing → transcode → detect scenes → placeholder transcript → zip → mark complete + `expires_at` → send/log the ready email → clean up upload/work dirs). Verified with a real browser test — see `CLAUDE.md` → "Decided: pipeline orchestration" for the full account, including a real module-load-order bug this surfaced and fixed (`worker/lib/db.ts`).
- **File handoff — local dev shortcut, production version not built.** Worker and web app share `SHARED_TEMP_DIR` on disk because they're the same machine locally. The originally decided design (worker → web app over Railway's private networking) **does not exist yet** and is required before these could run as two separate Railway services — see `CLAUDE.md` → "Decided: pipeline orchestration" → "File handoff" for the full explanation, don't assume this works in a deployed context.
- **Delivery — built.** `GET /api/sessions/[id]/download`: auth-gated, atomically claims the session (`UPDATE ... WHERE status = 'complete' RETURNING id` — the concurrency guard against two simultaneous download attempts), streams the zip, deletes it, marks `downloaded`. Lazily flips overdue `complete` rows to `expired` at request time — see "Storage & retention" below and `CLAUDE.md` → "Decided: notifications & download window".

## Notifications

Email (Resend, via raw `fetch` to their REST API — `worker/lib/email.ts`, no SDK) + in-app polling (`components/AutoRefresh.tsx`, `router.refresh()` every 5s on `/sessions`, not a websocket/SSE). **`RESEND_API_KEY` is configured and verified working** (2026-08-14) — but no custom domain is verified with Resend, so delivery is currently limited to the Resend account owner's own email, not arbitrary signup users. See `CLAUDE.md` → "Decided: notifications & download window".

## Storage: bounded, not persistent

Nothing produced by the pipeline is kept long-term. Raw uploads and intermediate work files (transcoded mp4, raw screenshots) are deleted the moment the zip is built, success or failure. The *finished zip* is the one thing that isn't deleted instantly — it lives for up to 1 hour (`sessions.expires_at`) so email notifications and a returning user have something to actually download; see `CLAUDE.md` → "Decided: notifications & download window" for why that's not a contradiction of "ephemeral." No S3-compatible client, no `video_key`/`image_key` columns. See `CLAUDE.md` → "Decided: storage & retention" and `database.md`.

## Styling

- **Tailwind CSS v4** — `@import "tailwindcss"` in `globals.css`, theme tokens in `@theme inline {}`. Same Porcelain/Graphite/Alabaster Grey palette and Geist font as healthReference and patientRecordSystem.
- **Responsive nav pattern** (new): unlike the sibling apps, which only render one fixed-width desktop sidebar, `components/Sidebar.tsx` renders two separate elements — a horizontal top bar (`md:hidden`) and the vertical sidebar (`hidden md:flex`) — swapped via Tailwind breakpoints rather than one element with responsive classes. Both copies carry the same `data-tour` attributes so the guided tour (below) can resolve to whichever one is actually visible.

## Guided tour ("Tutorial" button)

Tooltip/coachmark-style tour via `driver.js`, triggered from the button on `app/(app)/dashboard/page.tsx` (`components/TutorialButton.tsx`). Steps target elements by `data-tour` attribute, resolved through a small helper that picks whichever matching element is actually visible (`offsetParent !== null`) — needed because the mobile top bar and desktop sidebar both render nav links with the same attributes, only one of which is on screen at a time. Popover styling is reskinned in `globals.css` (`.driver-popover*` rules) to match the app palette instead of driver.js's default theme.

## Data model shape

Two tables: `users` and `sessions` (a usage log, `user_id` FK). See [`database.md`](./database.md). No generic cross-entity relationship table like healthReference/patientRecordSystem — there's nothing to cross-link, `sessions` doesn't reference any stored output.
