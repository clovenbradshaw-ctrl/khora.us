# apps/eoreader/

eoReader — read-only viewer over EO data rooms.

## Planned scope

The same binary handles a public corpus, a member-only corpus, and a Megolm-encrypted vault. It just gets back content, ciphertext, or a 403 — the data room's permissions decide. App code cannot weaken them (SPEC §4.3).

Consumes `eo.corpus.v1` and (via the EO triple) any schema with sensible payloads to render as text.

## Phase

Phase 7. After bootstrap MVP, write path, and snapshots are live.
