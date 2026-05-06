# apps/

Apps that ship with Khora. Each is independently authored, versioned, permissioned, and forkable. Each is meant to be published into its own Matrix app room (SPEC §3) and fetched by bootstrap at session time.

An app in this directory is the *source* for an app room. Bootstrap never reads from this filesystem; it reads from Matrix. The relationship is: source repo → build → manifest event → iframe.

## Apps

| Directory | Status | Purpose |
|---|---|---|
| `khora-cm/` | Legacy single-app code lives at repo root, will move here in Phase 6 | Sovereign case management — the original Khora |
| `eodb/` | Planned | EO database workbench; nine-operator fold over any EO data room |
| `eoreader/` | Planned | Read-only viewer for any `eo.corpus.v1` or compatible schema |
| `eo-wiki/` | Planned | Append-rich wiki over `eo.corpus.v1` |
| `wire/` | Planned (Phase 2 — first real app to port) | RSS reader over `eo.feed.v1` |
| `anchorage/` | Planned | Anchorage-specific app (TBD) |

## Conventions

Each app directory ships:

- `manifest.template.json` — the manifest fields that don't depend on the build artifact (display name, accepted schemas, permissions required)
- `src/`, `index.html` — source
- `build/` or equivalent — produces a single bundled HTML/JS payload that bootstrap can load via `mxc://` (SPEC §3.2). Split-bundle mode (SPEC §3.3) is used when the build exceeds the homeserver media cap.
- `README.md` — what the app does, what schemas it consumes, what permissions it needs

The publishing flow lives in `tools/publish.ts` (Phase 0+).
