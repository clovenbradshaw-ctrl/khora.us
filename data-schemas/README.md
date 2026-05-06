# data-schemas/

Well-known data schemas — the schemas declared by data rooms via `m.room.data_schema` (SPEC §4.1).

| File | Used by | Purpose |
|---|---|---|
| `eo.case.v1.json` | Khora-CM | Sovereign case files (notes, evidence, tags, links, snapshots) |
| `eo.corpus.v1.json` | eoReader, eo-wiki | General-purpose document corpus |
| `eo.feed.v1.json` | wire | RSS / news feed items |
| `eo.eodb.v1.json` | EO///DB | Operator-rich workbench substrate |
| `eo.layout.v1.json` | any app using `@khora/ui` block composition | Dashboard layouts (event type `eo.layout.dashboard`); SPEC §17.2.4 |

Each schema is JSON Schema draft 2020-12 and validates the `payload` field of its event types. The EO triple (`content.eo.{operator, site, resolution}`, SPEC §4.2) is uniform across all schemas and validated by a shared schema fragment.

## Authoring a new data schema

1. Pick a `schema_id` (reverse-DNS-style, e.g. `org.example.X.v1`). Once published, treat it as immutable.
2. Enumerate `event_types` with `{type, operator, min_pl}`.
3. Write payload schemas for each event type.
4. For any payload field that may exceed ~16KB inline (long bodies, attachments, image / PDF blobs, large state snapshots), declare it under that event type's `externalizable_fields[]` array (SPEC §21.2). Bootstrap externalizes those fields automatically on `append`; readers see the field via `resolveMedia()`.
5. A field declared in `externalizable_fields[]` MUST NOT also appear in `materializers[]` (STORAGE §7) as a key, value projection, or graph endpoint — the materializer pipeline runs on inline content, not references. Apps needing both should duplicate a small projection (e.g., `body_excerpt` short field for indexing alongside a full `body` externalized field).
6. Publish into a real data room as a `m.room.data_schema` state event.
7. Add a registry entry so other apps can discover it (SPEC §7).

Breaking changes mint a new `schema_id` and (almost always) a new room. Migration is by `m.room.data_schema_migration` pointer (SPEC §4.4).
