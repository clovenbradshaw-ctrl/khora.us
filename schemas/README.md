# schemas/

JSON schemas for protocol-level events. These are the events bootstrap reads and writes; apps see them only indirectly through the capability API.

The Phase 0 deliverable is a complete, validated set of schemas for:

| File | Defined in SPEC |
|---|---|
| `m.room.app.json` | §3.1 |
| `m.room.app.manifest.json` | §3.2, §3.3 |
| `m.room.app.release.json` | §3.4 |
| `m.room.data_schema.json` | §4.1 |
| `m.room.data_schema_migration.json` | §4.4 |
| `m.room.registry.json` | §7 |
| `m.room.registry.entry.json` | §7 |
| `m.room.instance.json` | §14.4 |
| `eo.user.mount.json` | §5.1, §14.2 |
| `eo.user.snapshot.json` | §5.2 |
| `eo.user.preferences.v1.json` | §17.4 |
| `m.room.hydration.json` | §21.5 (room-shared hydration: state event referencing a `khora.hydration.v1` bundle) |
| `eo.user.hydration_index.json` | §21.6 (optional audit breadcrumb for an external hydration file; metadata only, never key material) |
| `khora.json` | §16.5 (repo-side config, not a Matrix event) |

Schemas are JSON Schema draft 2020-12. Every schema fixture has a matching example event under `tests/` (Phase 0) that round-trips through validation.

## `externalizable_fields[]` — schema amendment for data schemas

SPEC §21.2 adds an optional `externalizable_fields[]` array on each entry of a data schema's `event_types[]`. Each entry has `{ field: <dot-path>, threshold_bytes: <int>, compression: "gzip" | null }`. The amendment lives in `m.room.data_schema.json` and is recognized by data schemas under `data-schemas/`; the externalized field at rest is *either* the inline value *or* a reference structure of the same shape as the manifest media reference (SPEC §3.3 + §21.2). Schemas adopting it inherit transparent externalization on every `append` through any entry path. See SPEC §21 and `data-schemas/README.md`.

## Versioning

Three versioning strategies sit at different layers — keep them straight:

- **App manifest version** lives in the manifest event's `state_key` (`v1.4.0`, etc.; SPEC §3.2). Each release is a new state event with its own key; the app room's history is the release history.
- **Data-room schema version** lives in `schema_id` (`eo.case.v1`, `eo.case.v2`; SPEC §4.4). Breaking changes mint a new `schema_id` and almost always a new room.
- **Protocol event-type version** is in the event type name itself (`m.room.app.manifest.v2`), and is reserved for cases where breaking changes to a *protocol* event are unavoidable. Additive changes never bump the type. Bootstrap accepts the union of declared versions; apps see whatever the capability API hands them after migration shims.
