# npm Packages

As of the versions pinned in `package.json`. Run `npm ls <pkg>` or check `package.json` directly for current versions — don't trust this doc's version numbers blindly over time.

## Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.0 | App framework — App Router, route handlers, dev/build/start |
| `react` / `react-dom` | 19.2.4 | UI rendering |
| `pg` | ^8.20.0 | Raw Postgres driver — no ORM. See [`database.md`](./database.md) |
| `lucide-react` | ^1.8.0 | Icon set used throughout the UI |
| `driver.js` | ^1.8.0 | Powers the "Tutorial" button's guided tour (tooltip/coachmark style) on the home page — see `components/TutorialButton.tsx`. Loaded via dynamic `import()` inside the click handler so it isn't in the initial page bundle; its CSS is statically imported and reskinned in `app/globals.css` to match the app palette instead of the library's default blue/white theme. |

Not yet added, needed once the pipeline is built: a way to shell out to ffmpeg and to a local `whisper.cpp` binary, a zip library for bundling the download, and (separately, for auth) `bcryptjs`/similar for password hashing and `jose`/similar for session tokens. **No object-storage SDK needed** — unlike healthReference/patientRecordSystem there's no persistent file storage to talk to (see `architecture.md` → "Storage: ephemeral only, by design").

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

None, and none planned — transcription direction is `whisper.cpp` (C++, no Python), specifically to avoid a Python runtime dependency and to keep transcription fully local. See `CLAUDE.md` → "Decided: transcription".
