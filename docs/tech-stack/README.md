# Tech Stack Docs

Reference documentation for how this app is built — dependencies, database access, API design, and architecture. This is a snapshot of the current architecture, not a spec to build towards; when the code changes, update these docs alongside it.

- [`npm-packages.md`](./npm-packages.md) — every runtime and dev dependency, what it's for
- [`database.md`](./database.md) — Postgres access, migration pattern, schema shape
- [`api.md`](./api.md) — route handlers (none exist yet)
- [`architecture.md`](./architecture.md) — how the pieces fit together, and what's still unbuilt

There are no Python packages in this project — it's a single Next.js/TypeScript codebase, nothing polyglot (the eventual Whisper/ffmpeg integration may change that — see `architecture.md`).
