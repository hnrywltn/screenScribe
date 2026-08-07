# API

No route handlers exist yet — `app/page.tsx` and `app/sessions/page.tsx` query Postgres directly from server components via `lib/db.ts`, not through an API layer.

Will need at least an upload endpoint (`POST /api/sessions` or similar, accepting multipart `FormData`) once the processing pipeline exists — not built, see [`architecture.md`](./architecture.md) and `CLAUDE.md` → "Still open."
