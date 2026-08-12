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

**Mechanism decided (email + password), not implemented.** `users` table exists; no signup/login pages, no password hashing wired up, no session/cookie handling yet. See `CLAUDE.md` → "Decided: auth mechanism".

## The processing pipeline — not implemented

This is the core of what ScreenScribe is supposed to do, and none of it exists yet:

- **Transcode** — planned via ffmpeg, not installed on the dev machine yet, no invocation code written
- **Scene/slide detection** — approach undecided (frame diffing vs. a dedicated scene-detection library)
- **Transcription** — direction decided (local **whisper.cpp**, shelled out to like ffmpeg — no cloud API, no exceptions, regardless of a provider's stated training policy), model size not chosen, no invocation code written. See `CLAUDE.md` → "Decided: transcription".
- **Job orchestration** — shape decided, not built: a `pg-boss` (Postgres-backed) job queue, processed by a **second Railway service** acting as the worker, not a synchronous route handler and not a separate VM. Chosen to avoid a new hosting vendor and a new infra dependency (Redis) at this stage. Tradeoff: a generic Railway container has no Metal acceleration, so `whisper.cpp` runs CPU-only there — slower than the local Mac dev environment. See `CLAUDE.md` → "Decided: pipeline orchestration" for what's still open (worker repo layout, how the finished zip crosses back from worker to user, job payload shape).

## Storage: ephemeral only, by design

**Not "undecided" — deliberately nothing.** Earlier drafts of this doc had a "file storage backend TBD" section (R2 vs. B2 vs. local disk). That question no longer applies: nothing produced by the pipeline is kept past the response. The plan is a per-job temp directory (raw upload, extracted frames, transcoded mp4, transcript) that gets deleted — success or failure — once the zip has been streamed back to the browser. No S3-compatible client, no `video_key`/`image_key` columns (removed from the schema entirely, not left nullable for later). See `CLAUDE.md` → "Decided: storage & retention" and `database.md`.

## Styling

- **Tailwind CSS v4** — `@import "tailwindcss"` in `globals.css`, theme tokens in `@theme inline {}`. Same Porcelain/Graphite/Alabaster Grey palette and Geist font as healthReference and patientRecordSystem.
- **Responsive nav pattern** (new): unlike the sibling apps, which only render one fixed-width desktop sidebar, `components/Sidebar.tsx` renders two separate elements — a horizontal top bar (`md:hidden`) and the vertical sidebar (`hidden md:flex`) — swapped via Tailwind breakpoints rather than one element with responsive classes. Both copies carry the same `data-tour` attributes so the guided tour (below) can resolve to whichever one is actually visible.

## Guided tour ("Tutorial" button)

Tooltip/coachmark-style tour via `driver.js`, triggered from the button on the home page (`components/TutorialButton.tsx`). Steps target elements by `data-tour` attribute, resolved through a small helper that picks whichever matching element is actually visible (`offsetParent !== null`) — needed because the mobile top bar and desktop sidebar both render nav links with the same attributes, only one of which is on screen at a time. Popover styling is reskinned in `globals.css` (`.driver-popover*` rules) to match the app palette instead of driver.js's default theme.

## Data model shape

Two tables: `users` and `sessions` (a usage log, `user_id` FK). See [`database.md`](./database.md). No generic cross-entity relationship table like healthReference/patientRecordSystem — there's nothing to cross-link, `sessions` doesn't reference any stored output.
