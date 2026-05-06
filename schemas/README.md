# schemas/

JSON schemas for protocol-level events. These are the events bootstrap reads and writes; apps see them only indirectly through the capability API.

The Phase 0 deliverable is a complete, validated set of schemas for:

| File | Defined in SPEC |
|---|---|
| `m.room.app.json` | §3.1 |
| `m.room.app.manifest.json` | §3.2, §3.3 |
| `m.room.app.release.json` | §3.4 |
| `m.room.data_schema.json` | §4.1 |
| `m.room.registry.json` | §7 |
| `m.room.registry.entry.json` | §7 |
| `m.room.instance.json` | §14.4 |
| `eo.user.mount.json` | §5.1, §14.2 |
| `eo.user.snapshot.json` | §5.2 |

Schemas are JSON Schema draft 2020-12. Every schema fixture has a matching example event under `tests/` (Phase 0) that round-trips through validation.

## Versioning

Protocol schemas are versioned by event-type name when a breaking change is unavoidable (e.g. `m.room.app.manifest.v2`). Additive changes do not bump the type. Bootstrap accepts the union of declared versions; apps see whatever the capability API hands them after migration shims.
