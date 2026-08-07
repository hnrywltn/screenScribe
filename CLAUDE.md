# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Early build — stack scaffolded, schema migrated to a local dev DB, no processing pipeline yet.** Next.js/TypeScript app mirroring healthReference's and patientRecordSystem's stack (see "Decided: stack" below). Home dashboard and sessions list are wired to a real database (`sessions` table, currently empty). The actual video pipeline — transcode, scene detection, transcription — is **not implemented**, only its data model. See "Still open" below before assuming anything works end to end.

## Project

**ScreenScribe** — a user uploads a recorded presentation/lecture video (commonly `.mov`, but should accept multiple formats). The app processes it into a structured, downloadable package:

1. Screenshots of each new/distinct slide or screen shown in the video
2. A full transcript of the audio (via Whisper)
3. The original video converted to `.mp4`
4. All outputs organized into a clean per-session directory, downloadable individually or as a bundle (zip)

**Target users:** initially either healthcare professionals needing documentation for continuing-education (CE) courses, or college students wanting lecture notes/study material — market decision still open.

### Core technical pipeline (planned, not yet built)

1. **Upload & ingest** — accept common video formats (`.mov`, `.mp4`, `.avi`, etc.), validate, store temporarily
2. **Transcode** — convert to `.mp4` (likely via ffmpeg)
3. **Scene/slide detection** — detect "new screen" moments (frame diffing or scene-change detection), extract screenshots at those points, avoid duplicate/near-duplicate frames
4. **Transcription** — run audio through Whisper (local or API) to generate a timestamped transcript
5. **Packaging** — organize output per session: `/session_id/video.mp4`, `/session_id/screenshots/`, `/session_id/transcript.txt` (or `.srt`/`.vtt` for timestamp alignment)
6. **Delivery** — downloadable via the web UI, individually or as a zip

### Decided: stack (2026-08-07)

Mirrors healthReference's (`../momsProject`) and patientRecordSystem's (`../patientRecordsSystem`) stack, for consistency across the three Light Patterns apps: **Next.js 16 (App Router) + TypeScript + React 19 + Tailwind CSS v4 + raw SQL via `pg`, no ORM**, one hand-written idempotent `lib/migrate.ts`.

### Local development database

Local Postgres (Homebrew, same server already running for healthReference/patientRecordSystem) hosts a `screenscribe` database — same server process, separate database, no shared schema with the other two apps. Connection string is in `.env.local` (gitignored): `DATABASE_URL=postgres://henrywalton@localhost:5432/screenscribe`. Run `npm run migrate` after pulling schema changes; it's idempotent (`CREATE TABLE IF NOT EXISTS`), safe to re-run.

### Data model — what exists vs. what's still open (2026-08-07)

`lib/migrate.ts` currently covers only the schema needed to *record* a session's outputs, not produce them:

- `sessions` — one row per uploaded video: `name`, `original_filename`, `status` (uploaded / transcoding / detecting_scenes / transcribing / packaging / complete / failed), `video_key`, `error_message`, timestamps
- `screenshots` — one row per detected distinct slide/screen: `session_id`, `image_key`, `timestamp_seconds`, `ordinal`
- `transcript_segments` — one row per Whisper segment, timestamp-aligned: `session_id`, `start_seconds`, `end_seconds`, `text`, `ordinal`

**Deliberately not built yet — don't assume these exist or guess at their shape:**

- **The processing pipeline itself.** No ffmpeg invocation, no scene/slide-change detection algorithm, no Whisper integration, no job orchestration (synchronous request vs. background worker/queue) connecting them. Only the schema that will eventually record their output exists. `ffmpeg` is not even installed on this machine yet (`which ffmpeg` found nothing) — needed before any transcode work starts.
- **File storage backend** for uploaded videos, transcoded mp4s, and extracted screenshots — R2 (like healthReference), B2 (like patientRecordSystem's planned PHI storage), or local disk are all on the table. `video_key`/`image_key` columns are storage-agnostic strings so this can be decided later without a schema change.
- **Zip bundling / download delivery** — not implemented.
- **Auth** — none yet, single-user local tool for now, same starting point as the other two apps.

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
