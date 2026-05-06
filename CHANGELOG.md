# Changelog

## Unreleased

### Added
- `SPEC.md` — full specification for Khora as a bootstrap shell + protocol over Matrix rooms.
- `SPEC.md §14` — subscriptions and shared instances. Frames Khora as a master app users sign in to, with subscriptions (mounts) and instances (Matrix Spaces wrapping app+data) as the user-facing primitives. CRM/Airtable mental model crosswalk.
- Directory scaffold from SPEC §9: `bootstrap/`, `apps/{khora-cm,eodb,eoreader,eo-wiki,wire,anchorage}/`, `schemas/`, `data-schemas/`, `tools/`, each with a placeholder README explaining its scope.
- `CHANGELOG.md` (this file).

### Changed
- `README.md` rewritten. The repo is now a bootstrap, not an app. The legacy single-app README has been replaced; that document's content is preserved in git history.

### Deprecated
- The single-app architecture at the repo root. Existing source under `src/`, `index.html`, `package.json`, `vite.config.js` continues to build and run unchanged but will be moved into `apps/khora-cm/` during Phase 6 of the phased implementation.

### Notes
- This is a draft for repo overwrite. No protocol code has shipped. Phase 0 (protocol freeze + JSON schemas) is the next concrete step.
