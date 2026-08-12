# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Early build — stack scaffolded, schema migrated to a local dev DB, no processing pipeline yet.** Next.js/TypeScript app mirroring healthReference's and patientRecordSystem's stack (see "Decided: stack" below). Home dashboard and sessions list are wired to a real database. The actual video pipeline — transcode, scene detection, transcription — is **not implemented**, only its data model. See "Deliberately not built yet" under "Data model" below before assuming anything works end to end.

## Project

**ScreenScribe** — a paid service (per-video or subscription — see "Decided: business model" below). A user uploads a recorded presentation/lecture video (commonly `.mov`, but should accept multiple formats). The app processes it into a package they download **once**:

1. Screenshots of each new/distinct slide or screen shown in the video
2. A full transcript of the audio (via a locally-run Whisper — see "Decided: transcription")
3. The original video converted to `.mp4`
4. All three bundled into a single zip, streamed back as the download

**Target users:** initially either healthcare professionals needing documentation for continuing-education (CE) courses, or college students wanting lecture notes/study material — market decision still open.

### Core technical pipeline (planned, not yet built)

1. **Upload & ingest** — accept common video formats (`.mov`, `.mp4`, `.avi`, etc.), validate, store temporarily
2. **Transcode** — convert to `.mp4` (likely via ffmpeg)
3. **Scene/slide detection** — detect "new screen" moments (frame diffing or scene-change detection), extract screenshots at those points, avoid duplicate/near-duplicate frames
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

**Local Whisper only — no cloud transcription API**, regardless of any provider's stated training/retention policy. Users' video content should never leave the machine it's processed on. Leaning **whisper.cpp** (C++ port, no Python dependency, Metal-accelerated on Apple Silicon) invoked as a local binary the same way ffmpeg will be — fits the existing "shell out to a local tool" shape rather than introducing Python or a persistent model-serving process. Model size (tiny/base/small/medium/large — speed vs. accuracy) not yet chosen. **Not implemented yet** — this is the decided direction, not working code.

### Decided: auth mechanism (2026-08-12)

**Email + password**, not OAuth or magic-link — keeps credential storage in-house rather than round-tripping logins through a third-party identity provider, consistent with the local-processing-only stance above. `users` table exists (`email`, `password_hash`) but **login/signup pages, password hashing wiring, and session/cookie handling are not built yet**.

### Decided: pipeline orchestration (2026-08-12)

**A separate background worker service, not a synchronous request handler.** Real videos take minutes to transcode/detect-scenes/transcribe — well past any reasonable HTTP/reverse-proxy timeout, and a held-open request has no way to show progress and loses the job entirely on a server restart.

- **Job queue: `pg-boss`** (Postgres-backed) rather than Redis-backed (BullMQ, etc.) — reuses the Postgres already in the stack instead of adding a second infrastructure dependency. `sessions.status` is the natural place to reflect job progress (free-text column, no schema change needed to add intermediate values like `transcoding`/`detecting_scenes`/`transcribing` later if per-stage progress is wanted).
- **Worker host: a second Railway service**, not a standalone VM (Hetzner/DO/AWS/etc.) — chosen as the starting point specifically to avoid standing up a new hosting vendor, and because it's a platform already known here. It's a plain Linux container, so `whisper.cpp` runs **CPU-only, no Metal acceleration** — meaningfully slower than the Mac dev machine. Revisit a dedicated box (e.g. AWS EC2 Mac instances, for Metal-accelerated `whisper.cpp` in the cloud) only if transcription speed becomes a real problem under actual usage — not a preemptive optimization.

**Repo layout decided:** the worker lives in **this repo**, in a new `worker/` directory alongside `app/`, `lib/`, `components/` — deployed as a second Railway service from the same codebase, not split into a separate repo. Not scaffolded yet.

**Still open, don't guess at this:**
- How the finished zip actually reaches the user, since the worker — not the web app's request handler — is what produces it: the worker could serve a short-lived one-time download link itself, or hand the finished file back to the web app to stream out. Either way it has to happen without ever writing the zip to durable storage, per "Decided: storage & retention" above.

### Local development database

Local Postgres (Homebrew, same server already running for healthReference/patientRecordSystem) hosts a `screenscribe` database — same server process, separate database, no shared schema with the other two apps. Connection string is in `.env.local` (gitignored): `DATABASE_URL=postgres://henrywalton@localhost:5432/screenscribe`. Run `npm run migrate` after pulling schema changes; it's idempotent (`CREATE TABLE IF NOT EXISTS`), safe to re-run.

### Data model — what exists vs. what's still open (2026-08-12)

`lib/migrate.ts` covers only two tables, deliberately thin given "Decided: storage & retention" above — there's no media to reference, so there's nothing resembling the earlier `screenshots`/`transcript_segments` tables (removed, not just unused):

- `users` — `email` (unique), `password_hash`, `created_at`. For the future email+password auth — see "Decided: auth mechanism".
- `sessions` — a usage **log**, not a record of output: `user_id` (FK → `users`, `NOT NULL`), `original_filename`, `status` (`processing` / `complete` / `failed`), `error_message`, timestamps. No `video_key`/`image_key`/anything pointing at stored content, because nothing is stored. Currently unfiltered by user on `app/sessions/page.tsx` since there's no login session to filter by yet.

**Deliberately not built yet — don't assume these exist or guess at their shape:**

- **The processing pipeline itself.** No ffmpeg invocation, no scene/slide-change detection algorithm, no whisper.cpp integration, no `pg-boss` wiring, no worker service scaffolded, no ephemeral-temp-dir-then-zip-then-delete logic actually written yet. `ffmpeg` is not even installed on this machine (`which ffmpeg` found nothing). Orchestration *shape* is decided (see "Decided: pipeline orchestration") — none of it is built.
- **Auth implementation** — mechanism is decided (email+password) but no signup/login pages, no password hashing wired up, no session/cookie handling. `sessions.user_id` can't actually be populated by anything yet.
- **Billing/payment integration** — business model is "paid" but Stripe (or any provider), pricing, and the plan/credit shape are all undecided. Don't invent a `plans` or `credits` table.

### UI/architecture match, not a data dependency

Visually and structurally mirrors healthReference and patientRecordSystem — same Porcelain/Graphite/Alabaster Grey theme (`app/globals.css`), Geist font, sidebar nav (`components/Sidebar.tsx`), and dashboard "widget" tile pattern (`components/NewSessionWidget.tsx`, `components/SessionsWidget.tsx`). Unlike patientRecordSystem, **ScreenScribe has no data dependency on either sibling app** — this is purely a stack/UI convention match, not integration. `docs/tech-stack/` here documents ScreenScribe's own (still mostly unbuilt) architecture, not a copy of theirs.

## Commands

```bash
npm install         # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type-check without building
npm run migrate      # Run lib/migrate.ts against DATABASE_URL in .env.local
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
