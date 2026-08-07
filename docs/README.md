# Docs

- [`tech-stack/`](./tech-stack/) — how ScreenScribe itself is built: dependencies, database, API surface, architecture. This is a **snapshot** of the current (early) state, not a spec to build towards — update it as the app grows.
- [`changelogs/`](./changelogs/) — one file per day of work, `YYYY-MM-DD.md`, auto-created by the `Stop` hook in `.claude/settings.json` and filled in by Claude before each response ends. Same format as `../../momsProject/docs/changelogs/` and `../../patientRecordsSystem/docs/changelogs/`.

Unlike patientRecordSystem's `docs/`, there's nothing here copied from a sibling app — ScreenScribe doesn't read or depend on healthReference's or patientRecordSystem's data. The UI/stack conventions are shared (see `CLAUDE.md`), but that's a style match, not a docs dependency.
