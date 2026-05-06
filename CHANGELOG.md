# Changelog

## Unreleased

### Added
- `SPEC.md` — full specification for Khora as a bootstrap shell + protocol over Matrix rooms.
- `SPEC.md §14` — subscriptions and shared instances. Frames Khora as a master app users sign in to, with subscriptions (mounts) and instances (Matrix Spaces wrapping app+data) as the user-facing primitives. CRM/Airtable mental model crosswalk.
- `SPEC.md §15` — repo and room: development vs execution. The repo is source; the Matrix room is release. Bootstrap never reads from GitHub at runtime. CI is the publish step. Includes the publish pipeline, fork model across both layers, registry-as-seed pattern, and the honest-tension note on CI vendor centralization.
- `SPEC.md §16` — bootstrap UX surface. Three top-level surfaces (Mounts/Library/History), home-as-launcher-of-mounts, mirror-image Library for apps and data, fork modal, create-from-repo flow with `khora.json` repo config, schema-filtered mounting, three-lane history view, citation-as-event-ID-triple URLs, dense default with verbose toggle, settings drawer including the capability audit log. "One verb with arguments" framing.
- `SPEC.md §3.2` — optional `source` block on `m.room.app.manifest` (`repo`, `commit`, `tag`, `build_log`). Makes the repo↔room trust chain auditable end to end without making it required.
- `khora.json` repo config (referenced from §16.5) — minimal manifest declarations bootstrap reads from a source repo to drive create-from-repo. Schema lands in `schemas/` during Phase 0.
- `mxapp://` URI scheme (referenced from §16.3) — convenience scheme bootstrap accepts in the Add-by-URI input alongside room aliases and IDs.
- `STORAGE.md` — sibling spec for local persistence: IndexedDB layout (`events`, `state_current`, `checkpoints`, `indexes_live`, `sync`, `media`, `meta`), append-only changelog rules, schema-declared materializers, time-travel via `stateAt()`, capability-API additions for time-traveled queries and indexes, conflict/resync behavior, storage limits, EO operator alignment, and the invariants the cache must hold (determinism, recoverability, refetchability, time-travel exactness — all fuzz-testable). Treats `events` as REC ↬ made local; everything else is derivation.
- `SPEC.md §17` — standard surfaces and shared component library. Lifts EO-DB's component inventory into two layers: bootstrap-provided surfaces (member viewer, schema viewer, snapshot history, capability audit log, storage panel — every mount gets these for free) and a `@khora/ui` library apps opt into (universal views Table/Kanban/Calendar/Graph/Record/Horizon, EO-aware controls including operator filters and snapshot diff and REC trace, schema/constraint/resolution-policy editors, Notion-style block composition, collaboration surfaces). Adds `getOption`/`setOption` for cross-app user preferences with a frozen vocabulary (density, theme, operator badges, verbose, default view, audit verbosity). Migration path lifts EO-DB itself into the library so it consumes what it inspired.
- Directory scaffold from SPEC §9: `bootstrap/`, `apps/{khora-cm,eodb,eoreader,eo-wiki,wire,anchorage}/`, `schemas/`, `data-schemas/`, `tools/`, each with a placeholder README explaining its scope.
- `tools/README.md` adds `publish-from-ci.ts` (CI-side publish) and notes the `verify.ts` source-walk role.
- `apps/README.md` adds the per-app `.github/workflows/publish.yml` convention.
- `CHANGELOG.md` (this file).

### Changed
- `README.md` rewritten. The repo is now a bootstrap, not an app. The legacy single-app README has been replaced; that document's content is preserved in git history.

### Deprecated
- The single-app architecture at the repo root. Existing source under `src/`, `index.html`, `package.json`, `vite.config.js` continues to build and run unchanged but will be moved into `apps/khora-cm/` during Phase 6 of the phased implementation.

### Notes
- This is a draft for repo overwrite. No protocol code has shipped. Phase 0 (protocol freeze + JSON schemas) is the next concrete step.
