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

## The processing pipeline — mostly not implemented

This is the core of what ScreenScribe is supposed to do. Two pieces work, the rest doesn't:

- **Transcode — built and verified.** `ffmpeg` (v9.0, installed via Homebrew locally — **not yet set up on whatever the worker's Railway build ends up being**, that needs its own apt/nixpacks step later) via `worker/lib/ffmpeg.ts` → `transcodeToMp4(inputPath, outputPath)`. Shells out with `child_process.spawn` and an argument array (not a shell string, so no shell-injection surface), `libx264`/`aac`/`+faststart` — software encoding chosen deliberately over Apple's `videotoolbox` hardware encoder (also available locally) so behavior is identical between this Mac and the Linux worker in production. Verified against a real generated test file (synthetic `.mov`, mpeg4/PCM, via ffmpeg's own `lavfi` test source), confirmed via `ffprobe` the output is genuine h264/aac mp4 with correct duration, and confirmed the missing-input case rejects with a real error rather than hanging. **Not called from `worker/index.ts`'s job handler yet** — no upload endpoint exists to produce a real file to point it at.
- **Scene/slide detection — built and verified.** Also `worker/lib/ffmpeg.ts` → `extractSceneFrames(inputPath, outputDir, threshold = 0.3)`. Uses ffmpeg's own scene-change score (`select='eq(n,0)+gt(scene,threshold)'`, `-fps_mode vfr`) rather than a separate frame-diffing library or dedicated scene-detection package — no new dependency, reuses the tool already in place for transcode. `eq(n,0)` forces the first frame to always be included, since the first slide is never a detected "change" (confirmed empirically: without it, a 3-slide test produced only 2 frames, silently dropping the first slide). `threshold` defaults to `0.3`, a commonly-cited ffmpeg starting point — **not tuned against a real slide-deck recording**, only synthetic test content. Verified against a synthetic 3-slide video (solid red/blue/green segments, concatenated): confirmed exactly 3 distinct frames in the correct order (full-file hash comparison, and separately by downscaling each PNG to 1×1 with ffmpeg to read its literal average color — `fe0000`/`0000ff`/`018001`), and confirmed a video with zero scene changes still yields exactly one screenshot rather than zero. Same status as transcode: works, tested, **not called from the job handler yet**.
- **Transcription** — direction decided (local **whisper.cpp**, shelled out to like ffmpeg — no cloud API, no exceptions, regardless of a provider's stated training policy), model size not chosen, no invocation code written. See `CLAUDE.md` → "Decided: transcription".
- **Job orchestration** — a `pg-boss` (Postgres-backed) job queue, processed by a **second Railway service** acting as the worker, not a synchronous route handler and not a separate VM. Chosen to avoid a new hosting vendor and a new infra dependency (Redis) at this stage. Tradeoff: a generic Railway container has no Metal acceleration, so `whisper.cpp` runs CPU-only there — slower than the local Mac dev environment. **Scaffolded**: `worker/` (this repo, own `package.json`/`tsconfig.json`/`.env.local` — deliberately excluded from the root project's `tsconfig.json`/`eslint.config.mjs`, see "Worker package" below) connects to Postgres, starts `pg-boss`, creates a `process-session` queue, and has a handler registered. Verified locally end-to-end (job sent → received → completed, clean shutdown on `SIGTERM`). The handler itself is a stub — logs receipt, does nothing else.
- **File handoff** — the finished zip crosses from worker back to web app over **Railway's private internal networking**; the web app streams it to the browser, the worker never serves a public download. Keeps the worker (the service running ffmpeg/whisper.cpp on user-uploaded video) off the public internet entirely, and keeps the client talking to a single origin. See `CLAUDE.md` → "Decided: pipeline orchestration".

## Storage: ephemeral only, by design

**Not "undecided" — deliberately nothing.** Earlier drafts of this doc had a "file storage backend TBD" section (R2 vs. B2 vs. local disk). That question no longer applies: nothing produced by the pipeline is kept past the response. The plan is a per-job temp directory (raw upload, extracted frames, transcoded mp4, transcript) that gets deleted — success or failure — once the zip has been streamed back to the browser. No S3-compatible client, no `video_key`/`image_key` columns (removed from the schema entirely, not left nullable for later). See `CLAUDE.md` → "Decided: storage & retention" and `database.md`.

## Styling

- **Tailwind CSS v4** — `@import "tailwindcss"` in `globals.css`, theme tokens in `@theme inline {}`. Same Porcelain/Graphite/Alabaster Grey palette and Geist font as healthReference and patientRecordSystem.
- **Responsive nav pattern** (new): unlike the sibling apps, which only render one fixed-width desktop sidebar, `components/Sidebar.tsx` renders two separate elements — a horizontal top bar (`md:hidden`) and the vertical sidebar (`hidden md:flex`) — swapped via Tailwind breakpoints rather than one element with responsive classes. Both copies carry the same `data-tour` attributes so the guided tour (below) can resolve to whichever one is actually visible.

## Guided tour ("Tutorial" button)

Tooltip/coachmark-style tour via `driver.js`, triggered from the button on `app/(app)/dashboard/page.tsx` (`components/TutorialButton.tsx`). Steps target elements by `data-tour` attribute, resolved through a small helper that picks whichever matching element is actually visible (`offsetParent !== null`) — needed because the mobile top bar and desktop sidebar both render nav links with the same attributes, only one of which is on screen at a time. Popover styling is reskinned in `globals.css` (`.driver-popover*` rules) to match the app palette instead of driver.js's default theme.

## Data model shape

Two tables: `users` and `sessions` (a usage log, `user_id` FK). See [`database.md`](./database.md). No generic cross-entity relationship table like healthReference/patientRecordSystem — there's nothing to cross-link, `sessions` doesn't reference any stored output.
