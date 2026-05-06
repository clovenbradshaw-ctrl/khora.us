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
