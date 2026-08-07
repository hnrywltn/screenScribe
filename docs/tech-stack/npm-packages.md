# npm Packages

As of the versions pinned in `package.json`. Run `npm ls <pkg>` or check `package.json` directly for current versions — don't trust this doc's version numbers blindly over time.

## Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.0 | App framework — App Router, route handlers, dev/build/start |
| `react` / `react-dom` | 19.2.4 | UI rendering |
| `pg` | ^8.20.0 | Raw Postgres driver — no ORM. See [`database.md`](./database.md) |
| `lucide-react` | ^1.8.0 | Icon set used throughout the UI |

Not yet added, needed once the pipeline is built: an ffmpeg wrapper (or a shell-out), a Whisper client (local or API), a zip library for bundled downloads, and whatever file-storage SDK matches the chosen backend (`@aws-sdk/client-s3` for R2/B2-style storage, as used by healthReference/patientRecordSystem, if that's the direction chosen).

## Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Type-checking (`npx tsc --noEmit`) |
| `tailwindcss` + `@tailwindcss/postcss` | ^4 | Styling — v4 syntax, see [`architecture.md`](./architecture.md) |
| `eslint` + `eslint-config-next` | ^9 / 16.2.4 | Linting (`npm run lint`) |
| `tsx` | ^4.21.0 | Runs `lib/migrate.ts` directly |
| `dotenv` | ^17.4.2 | Loads `.env.local` into `lib/migrate.ts` (Next.js loads env vars automatically for the app itself; this standalone script needs it manually) |
| `@types/*` | — | Type definitions for `node`, `react`, `react-dom`, `pg` |

## Python packages

None currently. Whisper transcription may end up needing a Python component (or may go through an API instead) — undecided, see `CLAUDE.md` → "Still open."
