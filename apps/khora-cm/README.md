# apps/khora-cm/

Khora-CM — sovereign case management. The original Khora app, now one app among many.

## Status

The Khora-CM source currently lives at the repo root: `src/`, `index.html`, `package.json`, `vite.config.js`. It builds and runs unchanged.

Phase 6 of SPEC §10 moves it here and ports it onto the bootstrap:

- The vault / bridge / roster room pattern is preserved as the data-room side.
- Direct Matrix client calls are replaced by the capability API (SPEC §6.2).
- The app declares `accepts_schemas: ["eo.case.v1"]`.
- The build produces a single bundle published via the publish tool (SPEC §3.2 / `tools/publish.ts`).

Until that migration lands, treat this directory as a placeholder.

## Schema

Khora-CM consumes `eo.case.v1` (see `data-schemas/eo.case.v1.json` once written). Event types: `eo.case.note`, `eo.case.evidence`, `eo.case.tag`, `eo.case.link`, `eo.case.snapshot`. Power levels per SPEC §4.1.
