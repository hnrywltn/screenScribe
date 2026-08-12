# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Early build.** Next.js/TypeScript app mirroring healthReference's and patientRecordSystem's stack (see "Decided: stack" below). Public marketing/pricing page, working email+password auth (signup/login/logout, session-gated app routes), and a dashboard/sessions list wired to a real database all exist and are verified working. ffmpeg-based transcode and scene detection are tested, working functions in `worker/`. What's still missing: whisper.cpp transcription, an actual upload endpoint, and the job-handler logic tying the pipeline together — see "Deliberately not built yet" under "Data model" below before assuming anything end-to-end works.

## Project

**ScreenScribe** — a paid service (per-video or subscription — see "Decided: business model" below). A user uploads a recorded presentation/lecture video (commonly `.mov`, but should accept multiple formats). The app processes it into a package they download **once**:

1. Screenshots of each new/distinct slide or screen shown in the video
2. A full transcript of the audio (via a locally-run Whisper — see "Decided: transcription")
3. The original video converted to `.mp4`
4. All three bundled into a single zip, streamed back as the download

**Target users:** initially either healthcare professionals needing documentation for continuing-education (CE) courses, or college students wanting lecture notes/study material — market decision still open.

### Core technical pipeline (planned, not yet built)

1. **Upload & ingest** — accept common video formats (`.mov`, `.mp4`, `.avi`, etc.), validate, store temporarily
2. **Transcode** — convert to `.mp4` (**built**: `worker/lib/ffmpeg.ts` → `transcodeToMp4()`, see "Decided: pipeline orchestration" → "ffmpeg wired up")
3. **Scene/slide detection** — detect "new screen" moments and extract a screenshot per slide (**built**: `worker/lib/ffmpeg.ts` → `extractSceneFrames()`, see "Decided: pipeline orchestration" → "Scene detection wired up")
4. **Transcription** — run audio through Whisper (local or API) to generate a timestamped transcript
5. **Packaging** — zip the transcoded video, screenshots, and transcript (`.txt` or `.srt`/`.vtt`) together in an ephemeral temp directory
6. **Delivery** — stream the zip back to the browser as a one-time download, then delete the temp directory. Nothing is kept — see "Decided: storage & retention"

### Decided: stack (2026-08-07)

Mirrors healthReference's (`../momsProject`) and patientRecordSystem's (`../patientRecordsSystem`) stack, for consistency across the three Light Patterns apps: **Next.js 16 (App Router) + TypeScript + React 19 + Tailwind CSS v4 + raw SQL via `pg`, no ORM**, one hand-written idempotent `lib/migrate.ts`.

### Decided: business model (2026-08-12)

A **paid service** — per-video or subscription (not decided which, or both). This is the actual reason storage stays minimal (below): every video/screenshot/transcript kept around is cost that doesn't scale, not just a privacy nice-to-have. **Billing/payment integration (Stripe or otherwise, pricing, plan vs. metered-credit shape) is not decided and not built** — don't assume a `plans`/`subscriptions`/`credits` table exists or guess at one. `sessions` rows (see "Data model" below) are the only thing usage-tracking currently has to work with.

### Decided: storage & retention (2026-08-12)

**Nothing persists past the download.** A user's video, the extracted screenshots, and the transcript live only in an ephemeral temp directory for the duration of processing; once the zip is built and streamed back to the browser, that directory is deleted — success or failure. There is **no re-download** and no persistent object storage (no R2/B2/S3 needed at all, unlike healthReference/patientRecordSystem) — this replaces the earlier "file storage backend TBD" open item entirely, it's not TBD anymore, it's "there isn't one." All that persists in Postgres is the lightweight `sessions` usage-log row (filename, status, timestamp) — see "Data model" below.

### Decided: transcription (2026-08-12)

**Local Whisper only — no cloud transcription API**, regardless of any provider's stated training/retention policy. Users' video content should never leave the machine it's processed on. **whisper.cpp** (C++ port, no Python dependency, Metal-accelerated on Apple Silicon) invoked as a local binary the same way ffmpeg is — fits the existing "shell out to a local tool" shape rather than introducing Python or a persistent model-serving process.

**Model size: `medium`** (2026-08-12) — chosen after working through actual cost/speed numbers, not guessed at:
- Railway bills compute at ~$0.0009/vCPU+2GB-minute. Even the slowest realistic model choice landed around $0.02–0.03 of compute per 30-minute video — marginal transcription cost turned out to not be the pricing bottleneck at all (the fixed monthly cost of keeping a worker running dominates at low volume, not per-video compute). That freed up the model choice to prioritize accuracy over squeezing out the cheapest/fastest option.
- **Must run quantized (e.g. INT4/`q4`-class ggml weights), not full FP16** — benchmark data: FP16 `medium` runs *slower* than real-time on CPU (~1.8×), which would make a 30-minute video take ~54 minutes to transcribe; the quantized variant is faster than real-time (RTF ≈ 0.76, ~23 minutes for the same video). Exact quantization level (`q4_0` vs `q5_0` etc.) not pinned yet — a call to make once whisper.cpp is actually being installed and models compared for accuracy loss, not a business decision.
- Not implemented yet — this is the decided model choice, not working code. No whisper.cpp binary or model file exists on this machine yet.

### Decided: auth mechanism (2026-08-12) — built

**Email + password**, not OAuth or magic-link — keeps credential storage in-house rather than round-tripping logins through a third-party identity provider, consistent with the local-processing-only stance above.

- `lib/auth.ts` — `hashPassword`/`verifyPassword` (`bcryptjs`, 12 rounds), `createSession`/`clearSession`/`getCurrentUserId` (a signed JWT via `jose`, HS256, in an httpOnly cookie — `SESSION_SECRET` in `.env.local`, generated locally, gitignored, **production needs its own**, not the same value). 30-day expiry. `getCurrentUserId()` returns `null` for a missing/expired/tampered cookie rather than throwing — callers treat "no session" and "bad session" identically.
- `app/api/auth/{signup,login,logout}/route.ts` — signup validates email format + 8-char-minimum password, hashes, inserts, and relies on the `users.email` unique constraint (Postgres error `23505`) for the race-safe duplicate check rather than a pre-check `SELECT` (which would have a TOCTOU gap). Login returns the same generic "Invalid email or password" whether the email doesn't exist or the password is wrong — deliberate, avoids user-enumeration.
- **No `middleware.ts`** — auth gating happens in `app/(app)/layout.tsx` (a server component that calls `getCurrentUserId()` and `redirect("/login")` if absent), not Next.js middleware. Keeps the "no middleware" pattern consistent with healthReference/patientRecordSystem rather than introducing a new architectural layer.
- Verified end-to-end with a real browser (Playwright, scratch script, not committed): signup → dashboard, logout → redirected to `/login` on next visit to a protected route, duplicate-email signup shows the 409 error, wrong password shows the generic 401, correct login succeeds, and visiting `/login`/`/signup` while already authenticated redirects to `/dashboard` instead of showing the form again.
- **Not built**: password reset/forgot-password, email verification, rate limiting on login attempts. `sessions.user_id` still isn't populated by anything (no upload flow exists to create a session row yet), and `app/(app)/sessions/page.tsx` still queries all sessions unfiltered rather than scoping to the logged-in user — the auth *mechanism* works, but nothing downstream uses `getCurrentUserId()` yet outside the layout gate itself.

### Decided: pipeline orchestration (2026-08-12)

**A separate background worker service, not a synchronous request handler.** Real videos take minutes to transcode/detect-scenes/transcribe — well past any reasonable HTTP/reverse-proxy timeout, and a held-open request has no way to show progress and loses the job entirely on a server restart.

- **Job queue: `pg-boss`** (Postgres-backed) rather than Redis-backed (BullMQ, etc.) — reuses the Postgres already in the stack instead of adding a second infrastructure dependency. `sessions.status` is the natural place to reflect job progress (free-text column, no schema change needed to add intermediate values like `transcoding`/`detecting_scenes`/`transcribing` later if per-stage progress is wanted).
- **Worker host: a second Railway service**, not a standalone VM (Hetzner/DO/AWS/etc.) — chosen as the starting point specifically to avoid standing up a new hosting vendor, and because it's a platform already known here. It's a plain Linux container, so `whisper.cpp` runs **CPU-only, no Metal acceleration** — meaningfully slower than the Mac dev machine. Revisit a dedicated box (e.g. AWS EC2 Mac instances, for Metal-accelerated `whisper.cpp` in the cloud) only if transcription speed becomes a real problem under actual usage — not a preemptive optimization.

**Repo layout decided:** the worker lives in **this repo**, in a `worker/` directory alongside `app/`, `lib/`, `components/` — deployed as a second Railway service from the same codebase, not split into a separate repo.

**File handoff decided:** once a job finishes, the worker sends the finished zip to the web app over **Railway's private internal networking**, and the web app streams it to the browser — the worker never serves a public download itself. Chosen over the worker exposing its own public one-time-link endpoint because it means the worker (the service actually running ffmpeg/whisper.cpp on user-uploaded video) never needs to accept public internet traffic at all — smaller attack surface — and the client only ever talks to one origin (no CORS, one TLS cert to manage). The tradeoff (an extra hop for the file) is a private in-datacenter transfer, not a real cost, unlike a second public round-trip would be. The zip still touches disk only in each service's own ephemeral temp space — never written anywhere durable. Not implemented yet.

**Worker scaffolded (2026-08-12):** `worker/` is a real, separate npm package — its own `package.json`/`tsconfig.json`/`.env.local`, **not** part of the root Next.js project (root `tsconfig.json` and `eslint.config.mjs` both explicitly exclude it — the two packages have diverging dependency versions, e.g. different `@types/node` majors, and shouldn't be typechecked/linted as one program). `worker/index.ts` connects to Postgres, starts `pg-boss`, creates a `process-session` queue, and registers a handler — verified end-to-end locally (sent a real job via `boss.send()`, confirmed the worker received and completed it, confirmed graceful shutdown on `SIGTERM`). **The handler is a stub** — it logs receipt and does nothing else. Nothing enqueues real jobs yet (no upload endpoint in the web app calls `boss.send()`).

**ffmpeg wired up (2026-08-12):** `ffmpeg` installed locally via Homebrew (`brew install ffmpeg`, v9.0 — not installed automatically, was a manual one-time step on this machine, will need the equivalent on whatever the worker's Railway container build ends up being, e.g. a `nixpacks.toml`/Dockerfile `apt-get install ffmpeg` — **not set up yet**, this is dev-machine-only so far). `worker/lib/ffmpeg.ts` exports `transcodeToMp4(inputPath, outputPath)`, shelling out via `child_process.spawn` (argument array, not a shell string) to `libx264`/`aac`/`+faststart` — libx264/aac specifically chosen over Apple's hardware encoder (`videotoolbox`, also available locally) so encoding behaves identically between this Mac and the Linux worker in production. Verified for real: generated a synthetic non-mp4 test video (`.mov`, mpeg4/PCM, via ffmpeg's own `lavfi` test source — not a committed fixture, one-off in scratch), ran it through `transcodeToMp4`, confirmed via `ffprobe` the output is genuinely h264/aac mp4 with the correct duration preserved, and confirmed the rejection path on a missing input file surfaces a useful error instead of hanging or silently failing. **Not yet wired into `worker/index.ts`'s job handler** — there's still no real uploaded file for it to run against (no upload endpoint in the web app), so calling it from the handler right now would mean pointing it at a hardcoded/fake path.

**Scene detection wired up (2026-08-12):** approach decided — **ffmpeg's own scene-change score** (`select='eq(n,0)+gt(scene,threshold)'`, `-fps_mode vfr`), not a separate frame-diffing library or dedicated scene-detection package, since it reuses the tool already shelled out to for transcode rather than adding a new dependency. `eq(n,0)` always keeps the very first frame — the first slide is never a detected "change," so without it the first slide would silently be missing (confirmed empirically before adding it: a 3-slide test produced only 2 frames). `worker/lib/ffmpeg.ts` exports `extractSceneFrames(inputPath, outputDir, threshold = 0.3)`, returning the ordered list of extracted frame paths; `threshold` defaults to `0.3` (a commonly-cited ffmpeg starting point) — **not tuned against a real slide-deck recording yet**, only synthetic test content, may need adjustment. Verified for real: generated a synthetic 3-slide video (solid red/blue/green segments via `lavfi`, concatenated — not committed, scratch only), confirmed exactly 3 distinct frames extracted in the correct order (checked via full-file hashes *and* by downscaling each PNG to 1×1 with ffmpeg to read its average color directly — `fe0000`/`0000ff`/`018001`, i.e. red/blue/green), and confirmed a video with zero scene changes still yields exactly one screenshot (the `eq(n,0)` fallback) instead of zero. Same status as transcode: **the function works and is tested, but nothing calls it yet** — no real uploaded video exists to run it against.

### Local development database

Local Postgres (Homebrew, same server already running for healthReference/patientRecordSystem) hosts a `screenscribe` database — same server process, separate database, no shared schema with the other two apps. Connection string is in `.env.local` (gitignored): `DATABASE_URL=postgres://henrywalton@localhost:5432/screenscribe`. Run `npm run migrate` after pulling schema changes; it's idempotent (`CREATE TABLE IF NOT EXISTS`), safe to re-run.

### Data model — what exists vs. what's still open (2026-08-12)

`lib/migrate.ts` covers only two tables, deliberately thin given "Decided: storage & retention" above — there's no media to reference, so there's nothing resembling the earlier `screenshots`/`transcript_segments` tables (removed, not just unused):

- `users` — `email` (unique), `password_hash`, `created_at`. For the future email+password auth — see "Decided: auth mechanism".
- `sessions` — a usage **log**, not a record of output: `user_id` (FK → `users`, `NOT NULL`), `original_filename`, `status` (`processing` / `complete` / `failed`), `error_message`, timestamps. No `video_key`/`image_key`/anything pointing at stored content, because nothing is stored. Currently unfiltered by user on `app/(app)/sessions/page.tsx` — auth exists now (see below) but nothing queries by `user_id` yet, since no upload flow exists to create session rows in the first place.

**Deliberately not built yet — don't assume these exist or guess at their shape:**

- **The processing pipeline itself.** `worker/` exists and can receive/complete a job, and both `transcodeToMp4()` and `extractSceneFrames()` (ffmpeg) are tested, working functions — see "Decided: pipeline orchestration" for both. But the job handler is still a stub that doesn't call either: no whisper.cpp integration, no ephemeral-temp-dir-then-zip-then-handback logic tying it all together. Nothing in the web app creates real jobs yet either — no upload endpoint calls `boss.send()`, so there's no real input file to point either function at.
- **Billing/payment integration** — business model is "paid" but Stripe (or any provider), pricing, and the plan/credit shape are all undecided. Don't invent a `plans` or `credits` table. The pricing section on the hero page (`app/(marketing)/page.tsx`) uses placeholder `$X`/`$Y` values, explicitly labeled as such — not real prices, don't treat them as decided numbers to build against.

### Routing structure (2026-08-12)

Two route groups, each with its own layout — introduced alongside auth since logged-out (marketing) and logged-in (app) pages need different chrome:

- **`app/(marketing)/`** — public, no `Sidebar`. `page.tsx` is the hero/pricing landing page at `/`, plus `login/` and `signup/`. Its layout (`app/(marketing)/layout.tsx`) shows a simple header — "Log in"/"Get Started" links if logged out, a "Dashboard" link if logged in (reads `getCurrentUserId()`, doesn't redirect, just changes what's shown).
- **`app/(app)/`** — `dashboard/` (the tile dashboard, moved here from the old `app/page.tsx`), `sessions/`, `upload/`. Its layout (`app/(app)/layout.tsx`) renders `Sidebar` and redirects to `/login` if there's no session — this is the auth gate, see "Decided: auth mechanism".
- Route groups don't affect the URL — `/dashboard`, `/sessions`, `/upload` are still those exact paths, just nested under `(app)/` in the filesystem for layout purposes.
- Root `app/layout.tsx` is now minimal — just `<html>`/`<body>`/font, no `Sidebar`, since that's specific to `(app)/layout.tsx` now.
- `components/Sidebar.tsx`'s "Home" nav link and brand link now point to `/dashboard` (not `/`, which is the public marketing page now) and it gained a "Log out" button (POSTs to `/api/auth/logout`, then `router.push("/")`).

**Dev login:** `npm run seed` upserts a fixed dev account (`dev@screenscribe.test` / `devpassword123`) via `lib/seed.ts` — log in with it at `/login` instead of signing up fresh every time the local DB gets reset. Dev-only seed data, not a bypass in the auth code itself — deliberately didn't hardcode a special-case credential check into `app/api/auth/login/route.ts`, since that's exactly the kind of thing that's dangerous to leave in security-critical code.

`components/LoginForm.tsx` also pre-fills those credentials, gated on `process.env.NODE_ENV === "development"` — a build-time constant Next.js replaces before bundling (the same mechanism React itself uses to strip its own dev-only code), not a runtime `if` that could be toggled or bypassed. **Verified this is actually stripped, not just hidden**: ran `npm run build`, then grepped the real output (`.next/server`, `.next/static`, excluding `.map` files) for both credential strings — zero matches. They only appear in a server-chunk source map (expected — maps embed original source for debugging, not executable logic, and aren't sent to the browser regardless). Shows a small "Dev mode" note on the form itself so the pre-fill is never mistaken for a real remembered login.

### UI/architecture match, not a data dependency

Visually and structurally mirrors healthReference and patientRecordSystem — same Porcelain/Graphite/Alabaster Grey theme (`app/globals.css`), Geist font, sidebar nav (`components/Sidebar.tsx`), and dashboard "widget" tile pattern (`components/NewSessionWidget.tsx`, `components/SessionsWidget.tsx`). The marketing hero page reuses the same palette rather than introducing new colors, styled with card/tile patterns consistent with the rest of the app (see "Routing structure" above). Unlike patientRecordSystem, **ScreenScribe has no data dependency on either sibling app** — this is purely a stack/UI convention match, not integration. `docs/tech-stack/` here documents ScreenScribe's own (still mostly unbuilt) architecture, not a copy of theirs.

## Commands

Web app (run from repo root):

```bash
npm install         # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type-check without building
npm run migrate      # Run lib/migrate.ts against DATABASE_URL in .env.local
npm run seed         # Upsert the dev login (dev@screenscribe.test / devpassword123)
```

Worker (separate package — run from `worker/`, not the repo root):

```bash
cd worker
npm install          # Install dependencies (own node_modules, not shared with root)
npm run dev           # Start the worker (tsx watch), connects to DATABASE_URL in worker/.env.local
npx tsc --noEmit      # Type-check
```

## Working here

Talk through architecture/scope with the user before writing pipeline implementation code (transcode, scene detection, transcription, storage), especially since the approach for each is still explicitly open above — don't guess at a tool/library choice and build against it unprompted. When decisions land or new pieces get built, keep this file (and `docs/changelogs/`) in sync with what's actually built.

## Git & changelog workflow

This repo auto-commits locally after every response (a `Stop` hook in `.claude/settings.json` stages and commits any changes, creating `docs/changelogs/YYYY-MM-DD.md` if it doesn't exist yet). **The hook only guarantees a commit happens and the file exists — it does not write the actual changelog content.** Before ending a response that changed anything, add/append a `##`-sectioned entry to today's `docs/changelogs/YYYY-MM-DD.md` describing what changed, matching the style of `../momsProject/docs/changelogs/` and `../patientRecordsSystem/docs/changelogs/`. **Never push** — commits stay local unless the user explicitly asks otherwise.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
