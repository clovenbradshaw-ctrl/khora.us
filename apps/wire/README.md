# apps/wire/

wire — RSS reader, the first real app to port to the new bootstrap.

## Planned scope

Reads RSS items from a public data room (schema `eo.feed.v1`). Read-only. No user write path. Exercises SPEC §3 (app room + manifest + media bundle), §4 (data room + schema), and §6 (capability API: `read`, `subscribe`, `resolveMedia`) end-to-end without write complexity.

## Phase

Phase 2 — the first port after bootstrap MVP. By the time wire works, every read-side primitive in the protocol has been driven through.
