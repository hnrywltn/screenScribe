# Architecture

## Framework

- **Next.js 16** (App Router), TypeScript, React 19
- `app/` — pages (`app/page.tsx`, `app/sessions/`, `app/upload/`) and API route handlers (`app/api/`, none exist yet)
- `lib/` — shared server code (`db.ts`, `migrate.ts`)
- `components/` — UI components

## ORM

**None.** Database access is raw SQL via the `pg` driver (`lib/db.ts`), matching healthReference and patientRecordSystem. See [`database.md`](./database.md).

## Middleware

**None.** No `middleware.ts` — no request interception, no auth gate.

## Auth

**None.** Single-user local tool at this stage, same starting point as healthReference and patientRecordSystem.

## The processing pipeline — not implemented

This is the core of what ScreenScribe is supposed to do, and none of it exists yet:

- **Transcode** — planned via ffmpeg, not installed on the dev machine yet, no invocation code written
- **Scene/slide detection** — approach undecided (frame diffing vs. a dedicated scene-detection library)
- **Transcription** — planned via Whisper, local-model vs. API undecided
- **Job orchestration** — undecided whether pipeline steps run synchronously in a route handler or via a background worker/queue; video processing is slow enough that synchronous request/response is unlikely to be the final answer, but nothing is built to evaluate yet

## File storage

**Not decided.** `sessions.video_key` and `screenshots.image_key` are storage-agnostic string columns (mirroring healthReference's `attachments.file_key` pattern) so the backend — Cloudflare R2 (healthReference), Backblaze B2 (patientRecordSystem), or local disk — can be chosen later without a schema change.

## Styling

- **Tailwind CSS v4** — `@import "tailwindcss"` in `globals.css`, theme tokens in `@theme inline {}`. Same Porcelain/Graphite/Alabaster Grey palette and Geist font as healthReference and patientRecordSystem.

## Data model shape

Three tables so far, all scoped under one `sessions` row per uploaded video: `screenshots` and `transcript_segments` both hold `session_id` foreign keys with `ON DELETE CASCADE`. See [`database.md`](./database.md). No generic cross-entity relationship table like healthReference/patientRecordSystem — there's only one primary concept (a session) so far, nothing to cross-link yet.
