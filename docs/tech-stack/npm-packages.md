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
| `bcryptjs` | ^3.0.3 | Password hashing for email+password auth (12 rounds) — see `lib/auth.ts` and `CLAUDE.md` → "Decided: auth mechanism" |
| `jose` | ^6.2.8 | Signs/verifies the session JWT stored in an httpOnly cookie — `lib/auth.ts` |
| `pg-boss` | ^12.27.0 | Same job queue as the worker package below, added to the **root** package too (2026-08-14) so `app/api/sessions/route.ts` can enqueue jobs (`lib/queue.ts`) — previously only the worker could create a `PgBoss` client. A lazily-started singleton, idempotently ensures the `process-session` queue exists before sending so it doesn't depend on the worker having started first. |
| `stripe` | ^22.5.0 | Server-side Stripe SDK — `lib/stripe.ts`, the three `app/api/stripe/*` routes, and the webhook handler. Default API version is `2026-07-29.dahlia`; `stripe listen` must be run with `--latest`/`-l` locally or it forwards events shaped for the Stripe account's own (older) default version instead — see `CLAUDE.md` → "Decided: billing". |
| `@stripe/stripe-js` | ^9.13.0 | Client-side Stripe.js loader (`loadStripe`) — `components/billing/StripeElementsProvider.tsx` |
| `@stripe/react-stripe-js` | ^6.8.1 | React bindings for Stripe Elements (`Elements`, `PaymentElement`, `useStripe`, `useElements`) — the embedded checkout UI on `/billing`, not Stripe Checkout's hosted redirect |

Not yet added, needed once the pipeline is built: a way to shell out to a local `whisper.cpp` binary (ffmpeg itself is already wired up, see `architecture.md`). **No object-storage SDK needed** — unlike healthReference/patientRecordSystem there's no persistent file storage to talk to (see `architecture.md` → "Storage: bounded, not persistent").

## Worker package (`worker/`)

**Entirely separate `package.json`, not part of this table above.** See `architecture.md` → "Worker package" for why it's kept isolated from the root project.

| Package | Version | Purpose |
|---|---|---|
| `pg-boss` | ^12.27.0 | Postgres-backed job queue — see `CLAUDE.md` → "Decided: pipeline orchestration". Requires `boss.createQueue()` before `work()`/`send()` in this version; provisions its own `pgboss` Postgres schema automatically on `start()`. |
| `pg` | ^8.23.0 | Same role as the root package's `pg` — raw Postgres driver, no ORM |
| `dotenv` | ^17.4.2 | Loads `worker/.env.local` (mirrors the root's `lib/migrate.ts` pattern) |
| `archiver` | ^8.0.0 | Zips the finished download (`video.mp4` + `screenshots/*.png` + `transcript.txt`) — streamed to disk via `new ZipArchive({ zlib: { level: 9 } })` + `.pipe()`, not buffered in memory. v8's API is class-based (`ZipArchive`/`TarArchive`), not the older `archiver('zip', opts)` factory function — confirmed against the installed version's README before writing code, not assumed from memory. |

Dev: `typescript` ^7.0.2, `tsx` ^4.23.12 (runs `index.ts` directly, no build step — `npm run dev` uses `tsx watch`), `@types/node` ^26.2.0, `@types/pg` ^8.21.0, `@types/archiver`. **Note the version gap from the root package** (`typescript` ^5, `@types/node` ^20) — resolved independently since `npm install` was run separately inside `worker/`, not a deliberate pin. Not yet added: whisper.cpp invocation.

### Email — no SDK, raw `fetch`

`worker/lib/email.ts` calls Resend's REST API directly (`fetch("https://api.resend.com/emails", ...)`) rather than adding their SDK as a dependency — one endpoint doesn't justify it. See `CLAUDE.md` → "Decided: notifications & download window".

### System dependencies (not npm packages)

- **`ffmpeg`** (v9.0) — installed via Homebrew (`brew install ffmpeg`), **not** an npm dependency, so it doesn't show up in either `package.json`. `worker/lib/ffmpeg.ts` shells out to the `ffmpeg` binary on `PATH`. **`lib/ffprobe.ts` (root package, 2026-08-14) also shells out to `ffprobe`** — the same install, but now needed by the *web app* too (for upload-time duration probing/token charging), not just the worker. Installed manually on this dev machine only, shared between both processes since they're the same machine locally — production needs it on **both** the worker's and the web app's own Railway containers (not set up yet, e.g. a `nixpacks.toml` or `apt-get install ffmpeg` in a Dockerfile).
- **`whisper.cpp`** — planned, not installed yet. See `CLAUDE.md` → "Decided: transcription".
- **Stripe CLI** — needed locally to forward webhook events (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) since Stripe can't reach `localhost` directly. Homebrew's bottle install failed here (outdated Xcode, would have required a from-source build) — installed by pulling the prebuilt arm64 binary directly from the [stripe-cli GitHub releases](https://github.com/stripe/stripe-cli/releases) into `~/.local/bin` instead. See `CLAUDE.md` → "Decided: billing".

## Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Type-checking (`npx tsc --noEmit`) |
| `tailwindcss` + `@tailwindcss/postcss` | ^4 | Styling — v4 syntax, see [`architecture.md`](./architecture.md) |
| `eslint` + `eslint-config-next` | ^9 / 16.2.4 | Linting (`npm run lint`) |
| `tsx` | ^4.21.0 | Runs `lib/migrate.ts` directly |
| `dotenv` | ^17.4.2 | Loads `.env.local` into `lib/migrate.ts` (Next.js loads env vars automatically for the app itself; this standalone script needs it manually) |
| `@types/*` | — | Type definitions for `node`, `react`, `react-dom`, `pg`, `bcryptjs` |

## Python packages

None, and none planned — transcription direction is `whisper.cpp` (C++, no Python), specifically to avoid a Python runtime dependency and to keep transcription fully local. See `CLAUDE.md` → "Decided: transcription".
