# apps/eo-wiki/

eo-wiki — append-rich wiki over EO data rooms.

## Planned scope

Wiki-style editing on top of `eo.corpus.v1`. Exists in the phase plan because it's the simplest non-trivial test of the write path: it needs `append`, conflict-tolerant editing, and DEF tagging for revisions.

## Phase

Phase 3 — added in the same window the write path lands, as the second app on the new bootstrap (after Phase 2's `wire`). Validates §6.2 `append` and `subscribe` end-to-end before Khora-CM is unblocked.
