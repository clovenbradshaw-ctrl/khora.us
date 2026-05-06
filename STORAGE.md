# Khora — Storage Specification

**Status:** draft, sibling to SPEC.md
**Scope:** local persistence in the bootstrap and apps
**Frame:** REC ↬ as the canonical substrate, materialized state as derivation

---

## 1. Purpose

Define how Matrix room data is cached locally so that:

- Every change is preserved as an append-only event in a **changelog**.
- Current state is a **materialization** of the changelog, recomputable at any time.
- **Checkpoints** snapshot materialized state at specific event IDs, so replay doesn't have to start from genesis.
- **Time travel** to any past event ID is a primitive operation, not a bolted-on feature.
- The cache is consistent with what Matrix already provides; we don't invent a new model, we surface the one Matrix already has.

The local cache is never the source of truth. It is a fast, replayable mirror of the Matrix rooms it tracks. If destroyed, it can be fully rebuilt from `/sync`.

---

## 2. Mental model

```
┌─────────────────────────────────────────────────┐
│  Matrix rooms (source of truth, REC ↬)          │
└──────────────────┬──────────────────────────────┘
                   │  /sync
                   ▼
┌─────────────────────────────────────────────────┐
│  Changelog: append-only event log per room      │
│  Every event ever received, in arrival order    │
└──────────────────┬──────────────────────────────┘
                   │  fold
                   ▼
┌─────────────────────────────────────────────────┐
│  Materialized state                             │
│   • current state (latest of each type+key)     │
│   • schema-declared indexes                     │
│   • derived caches                              │
└──────────────────┬──────────────────────────────┘
                   │  periodically
                   ▼
┌─────────────────────────────────────────────────┐
│  Checkpoints: state at event_id X               │
│  Lets replay start from X, not genesis          │
└─────────────────────────────────────────────────┘
```

Three layers, one direction of derivation. The changelog is the truth. Materialized state and checkpoints are caches; either can be discarded and rebuilt.

---

## 3. Storage layout (IndexedDB)

One database per homeserver per user: `khora:{user_id}:{homeserver}`.

Object stores:

### 3.1 `events`

Append-only changelog. One row per Matrix event ever observed.

```
keyPath:  [room_id, local_seq]
indexes:
  - by_event_id             (room_id, event_id)
  - by_room_ts              (room_id, origin_server_ts)
  - by_room_type            (room_id, type)
  - by_room_type_state_key  (room_id, type, state_key)  // sparse; state events only
```

Each row:

```json
{
  "room_id": "!abc:server",
  "local_seq": 1234567,
  "event_id": "$evt...",
  "type": "eo.case.note",
  "state_key": null,
  "sender": "@michael:server",
  "origin_server_ts": 1730000000000,
  "received_at": 1730000000123,
  "content": { ... },
  "unsigned": { ... },
  "is_state": false,
  "redacted_because": null
}
```

`local_seq` is a monotonic per-room counter. Arrival order, not Matrix ordering. Combined with `origin_server_ts` and Matrix's own ordering, gives us deterministic replay.

`is_state` flag separates state events for fast indexing without scanning all events.

### 3.2 `state_current`

Denormalized: latest state event per `(type, state_key)` per room. Fast reads.

```
keyPath:  [room_id, type, state_key]
```

Row:

```json
{
  "room_id": "!abc:server",
  "type": "m.room.power_levels",
  "state_key": "",
  "event_id": "$evt...",
  "local_seq": 1234567,
  "content": { ... }
}
```

Recomputable by scanning `events` with `is_state=true` per room. Kept up to date incrementally as events arrive.

### 3.3 `checkpoints`

Periodic snapshots of materialized state at a specific event.

```
keyPath:  [room_id, local_seq]
```

Row:

```json
{
  "room_id": "!abc:server",
  "local_seq": 1234567,
  "event_id": "$evt...",
  "origin_server_ts": 1730000000000,
  "taken_at": 1730000005000,
  "reason": "interval" | "state_change" | "user_pin" | "idle" | "manifest_update",
  "pinned": false,
  "state": {
    "all_state_events": [ ... ],
    "membership": { ... },
    "power_levels": { ... }
  },
  "indexes": {
    "notes_by_case": [ ... ],
    "tags_index": [ ... ]
  },
  "size_bytes": 234567
}
```

A checkpoint is a complete restoration target. Loading checkpoint at `local_seq=N` plus replaying events `(N, current]` reconstructs current state exactly.

### 3.4 `indexes_live`

Live, incrementally maintained materialized indexes declared by data schemas. Same shape as the `indexes` field inside checkpoints, but kept current.

```
keyPath:  [room_id, schema_id, index_id, key]
```

Updated on every event arrival per the schema's materializer declaration (§7).

### 3.5 `sync`

Per-room sync state.

```
keyPath:  room_id
```

```json
{
  "room_id": "!abc:server",
  "next_batch": "s12345_67890_...",
  "last_event_local_seq": 1234567,
  "last_event_id": "$evt...",
  "last_synced_at": 1730000000000,
  "schema_id": "eo.case.v1",
  "schema_event_id": "$schema_evt..."
}
```

Plus a global `_sync` row keyed by an empty string, holding the homeserver-wide `next_batch` token.

### 3.6 `media`

Blob cache for mxc:// resolution.

```
keyPath:  mxc_uri
```

```json
{
  "mxc_uri": "mxc://server/abc",
  "blob": Blob,
  "content_type": "text/html",
  "size_bytes": 234567,
  "sha256": "...",
  "fetched_at": 1730000000000,
  "last_accessed_at": 1730000000000,
  "pinned": false
}
```

LRU eviction unless `pinned`. Externalized field blobs (SPEC §21.2) reuse this same cache; apps see them through `resolveMedia()` as `Blob`s, never as `mxc://` strings.

### 3.7 `hydration`

Records hydration sources that have been applied to the local cache (SPEC §21.4–§21.7). Both room-shared (`m.room.hydration`) and external-file imports land here so the storage panel and the audit log can attribute "where did this room's history come from?" honestly.

```
keyPath:  [room_id, source_id]
indexes:
  - by_room_source         (room_id, source)
  - by_key_fingerprint     (key_fingerprint)   // sparse; external only
```

Row:

```json
{
  "room_id": "!abc:server",
  "source_id": "$evt_for_room_shared_OR_ext:9f86d081...",
  "source": "room" | "external",
  "format": "khora.hydration.v1",
  "created_at": 1730000000000,
  "imported_at": 1730000005000,
  "state_at_event_id": "$evt_at_snapshot",
  "media_references": ["mxc://server/A...", "mxc://server/B..."],
  "created_by": "@michael:michael.tld",
  "key_fingerprint": "base64-8-bytes",
  "signed_by_device": "ABC",
  "expires_at": null
}
```

Room-shared rows (`source: "room"`) sync from data rooms via the `m.room.hydration` state event and `source_id` is the event ID. External-file rows (`source: "external"`) are written by `importHydration` (SPEC §21.7) and `source_id` is `"ext:" + sha256_prefix` of the file. `key_fingerprint` is recorded for external rows only — never the key itself, never the passphrase. The store is the deduplication ground for re-imports: a second `importHydration` of the same file is a no-op past fingerprint check.

### 3.8 `outbound_queue`

Tracks pending writes that have hit the local changelog but not yet succeeded against the homeserver. Backs the §21.9 backpressure path and the SPEC §20 step 5 atomic-rollback semantics for failed externalization.

```
keyPath:  [room_id, local_seq]
indexes:
  - by_status              (room_id, status)
  - by_attempts            (room_id, attempts)
```

Row:

```json
{
  "room_id": "!abc:server",
  "local_seq": 1234567,
  "tentative_event_id": "$tentative_...",
  "event_data": { "type": "...", "content": { ... } },
  "status": "pending" | "sent" | "failed",
  "attempts": 0,
  "created_at": 1730000000000,
  "last_attempt_at": null,
  "last_error": null
}
```

Rows are cleared on 2xx homeserver confirmation (the changelog row is updated in place per SPEC §20.1 step 6). `failed` rows survive until the user explicitly abandons or retries them through the storage panel. The queue is **per-room** so a slow upload in one room never blocks writes in another.

### 3.9 `meta`

Miscellaneous singletons: user_id, homeserver_url, device_id, app preferences, capability audit log.

Schema metadata is **per-room**: the active `schema_id` and `schema_event_id` for a room live in that room's `sync` row (§3.5). `meta` does not duplicate them. A materializer rebuild is triggered when a room's `sync.schema_event_id` advances past the version that produced the current `indexes_live` rows for that room.

---

## 4. The changelog

### 4.1 Append rules

- Events are written to `events` exactly once, keyed by `(room_id, local_seq)`.
- `local_seq` increments monotonically per room on every successful insert.
- `event_id` is unique per room; duplicates from `/sync` retries are rejected via the `by_event_id` index. Duplicate writes are no-ops, not errors.
- Out-of-order arrivals (gappy `/sync`, federation lag, `/context` backfill) are inserted at their correct chronological position by `origin_server_ts` *only* if backfill is explicit. Live `/sync` writes always increment `local_seq` in arrival order, even if `origin_server_ts` is older — replay corrects.

### 4.2 Backfill

When the user scrolls into history or the app needs older events:

1. Call `/messages?from=...&dir=b`.
2. Insert returned events with `local_seq` values *below* the current minimum for that room (negative-going), or in a separate `events_backfill` partition. Recommended: separate partition to keep the live `local_seq` clean.
3. Mark gaps explicitly via `gap` rows in `events`:

```json
{
  "type": "_gap",
  "from_event_id": "$a",
  "to_event_id": "$b",
  "discovered_at": 1730000000000,
  "filled_at": null
}
```

Replay treats gaps as "state may be incomplete here." Apps can render with a "load more" affordance.

### 4.3 Redactions

A redaction event is itself an event in the changelog (append-only). The redacted target row in `events` is updated to set `redacted_because` and clear `content` per Matrix spec, but the original `local_seq` row is not removed. The redaction event's row stands alongside.

This preserves the audit chain: "what was redacted, by whom, when, against what" is fully visible. Only the *content* of the target is gone, in conformance with Matrix.

---

## 5. Materialized state

### 5.1 Definition

`state_current` holds the latest state event per `(room_id, type, state_key)`. It is a pure projection of `events` filtered to `is_state=true` and reduced to greatest `local_seq` per `(type, state_key)`.

Maintained incrementally:

- On every state event insert: upsert `state_current` if the new event's `local_seq` is greater than the existing row's. (It always is for live events; only matters for backfill.)

### 5.2 Schema-declared indexes

Beyond `state_current`, data schemas declare additional materialized indexes (§7). These live in `indexes_live`, are maintained incrementally on event insert per the materializer rules, and are recomputed when the schema version changes.

### 5.3 Recomputation

`state_current` and `indexes_live` are entirely derivable from `events`. Either or both can be wiped and rebuilt at any time:

1. Clear `state_current` (or `indexes_live`) for the affected room.
2. Scan `events` for that room in `local_seq` order, applying state-folding and materializer rules.
3. Done.

This is the recovery path for cache corruption, schema upgrades, or materializer bugs.

---

## 6. Checkpoints

### 6.1 When to checkpoint

Configurable, with sensible defaults. The trigger set:

| Trigger | Default | Rationale |
|---|---|---|
| Every N timeline events | 500 | Bounds replay cost |
| Every M minutes of activity | 30 | Bounds time-to-rebuild on crash |
| On any state event | yes | State changes are cheap to checkpoint and high-value |
| Sync-idle for T seconds | 30 | Quiet moment, good time to write |
| User-initiated snapshot | always | Pinned, never auto-evicted |
| Before manifest update | always | Pin known-good state before swapping app version |
| On schema migration | always | Last known state under old schema |

Per-room overrides allowed. Vault rooms may want every-event checkpointing; high-volume RSS rooms may want every-2000-events.

### 6.2 Checkpoint format

A checkpoint at `local_seq = N` contains:

- All state events as-of `N` (full snapshot of `state_current` filtered to that room at that point — equivalent to `/state?at=$evt_at_N`).
- All schema-declared indexes for that room as-of `N`.
- The `event_id`, `origin_server_ts`, and `local_seq` of the anchoring event.
- Reason for the checkpoint, for observability.

Checkpoints are **complete** — they are not deltas. Two checkpoints next to each other carry redundant information; that's the point. Restoration is one read, not a chain of merges.

### 6.3 Restoration

To restore state at a target `local_seq = T`:

1. Find latest checkpoint with `local_seq <= T`. Call it `C`.
2. Load `C.state` into `state_current` (in-memory or scoped clone, depending on use).
3. Load `C.indexes` into a working index set.
4. Scan `events` from `local_seq = C.local_seq + 1` through `T`, applying state-folding and materializer rules to the working set.
5. Result: materialized state as-of `T`.

If `T` is the current head, this is the live `state_current`. If `T` is a past event, this is a time-travel view used for snapshot restoration, audit, diff.

#### 6.3.1 Hydration during restoration

Hydration (SPEC §21.4–§21.7) is a **fast-fill** for cases where neither a checkpoint nor a contiguous changelog exists locally — a fresh device, a long-offline peer, an air-gapped recipient. On import, a hydration bundle becomes equivalent to "checkpoint at `as_of_event` plus the events leading up to it"; subsequent `/sync` continues incrementally from `as_of_event`. Externalized field references inside hydrated events resolve lazily through `media` (§3.6) — the bundle's optional `media-cache` section pre-populates that store; without it, blobs fetch on first access just like any other reference.

Hydration writes a `hydration` row (§3.7) recording the source, so the storage panel can show "this room's history was bootstrapped from <source> on <date>" rather than presenting derived state as if it had been live-synced.

### 6.4 Compaction

Default policy:

- Keep last 10 unpinned checkpoints per room.
- Keep all pinned checkpoints (user-created snapshots, manifest-update checkpoints) indefinitely.
- Keep all events between the oldest kept checkpoint and now.
- Events older than the oldest kept checkpoint may be evicted, but only if either:
  - The events have been `/_matrix/client/v1/messages`-fetchable on demand (no gaps to fill), or
  - The user has explicitly opted into aggressive eviction.

When evicting events, write a `_gap` marker (§4.2) so replay knows it's incomplete past that point.

For most rooms, never evict. Storage is cheap; the audit chain is valuable. Eviction is for high-volume read-only rooms (RSS feeds, public corpora) where deep history isn't worth the disk.

### 6.5 Three sources, one cache

The cache fills from three distinct paths. They serve overlapping purposes and stack — a device can run with checkpoints alone, ingest a room-shared hydration on join, and accept an external file at any later point.

| Source | Where it lives | When useful | Federates? |
|---|---|---|---|
| Device-local **checkpoints** (§6) | `checkpoints` store, never sent over the wire | Always-on local cache; bounds replay cost | No |
| **Room-shared hydration** (SPEC §21.5) | `m.room.hydration` state event in the data room | New devices joining a room with deep history; offline peers reconnecting | Yes (via Matrix) |
| **External hydration files** (SPEC §21.6) | Standalone `.khr` file the user holds outside Matrix | Disaster recovery, air-gap provisioning, cold storage, cross-org handoff with out-of-band keys | No (deliberately) |

Imports from any of the three paths land equivalent state in `state_current`, `indexes_live`, and `events`. The provenance is preserved in `checkpoints.reason` (for local pins) and the `hydration` store (for the two hydration paths) so restoration history remains auditable.

---

## 7. Schema-declared materializers

### 7.1 Why declarative

Apps could each maintain their own indexes, but then mounts of the same data room from different apps redo the same work. Materializers in the schema let the bootstrap maintain shared, app-agnostic indexes once.

The materializer language is intentionally limited. Anything more than what's declared, an app does itself by querying `events` directly through the capability API.

### 7.2 Declaration syntax

In `m.room.data_schema` content:

```json
{
  "schema_id": "eo.case.v1",
  "schema_version": "1.0.0",
  "event_types": [ ... ],
  "materializers": [
    {
      "id": "notes_by_case",
      "kind": "index",
      "source_event_type": "eo.case.note",
      "key": "payload.case_id",
      "value": {
        "event_id": "event_id",
        "title": "payload.title",
        "ts": "origin_server_ts",
        "sender": "sender"
      },
      "operator_semantics": "append"
    },
    {
      "id": "tag_membership",
      "kind": "set",
      "source_event_type": "eo.case.tag",
      "key": "payload.case_id",
      "value": "payload.tag_name",
      "operator_semantics": {
        "INS": "add",
        "DES": "remove",
        "DEF": "snapshot"
      }
    },
    {
      "id": "case_summary",
      "kind": "reduce",
      "source_event_types": ["eo.case.note", "eo.case.evidence", "eo.case.tag"],
      "key": "payload.case_id",
      "reducer": {
        "kind": "counter_per_type"
      }
    }
  ]
}
```

### 7.3 Materializer kinds

- **`index`** — multi-map: key → list of values. Values are projected from the event. Append-only by default; honors EO operator semantics if declared.
- **`set`** — set membership: key → set of values. Add/remove driven by event operator.
- **`reduce`** — single value per key, computed via a small fixed reducer vocabulary: `count`, `sum`, `last`, `first`, `min`, `max`, `counter_per_type`. Anything more complex is the app's job.
- **`graph`** — edges between keys. For relational data (eo.case.link, citation graphs, source provenance). Stored as adjacency rows in `indexes_live`.

### 7.4 Maintenance

On every event insert into `events`:

1. Look up the room's schema in `meta`.
2. For each materializer whose `source_event_type` matches the event's `type`, apply the materializer's update to `indexes_live`.
3. Done.

Cost: O(materializers matching this event type) per insert, with each materializer's update bounded by the size of the value projection (constant for `index`, `set`, and most `reduce` kinds; logarithmic for `graph`). Apps with large materializer sets should monitor rebuild latency rather than assuming negligibility — the Phase 0 fuzz harness (see §13) is the place to bound this empirically before locking schema decisions.

On schema version change: drop affected indexes, recompute by scanning `events`. Recomputation runs in a background worker; queries during recompute return "rebuilding" with a progress estimate.

---

## 8. Time travel

The unified primitive: **read state at event_id**.

```typescript
async function stateAt(roomId: string, eventId: string): Promise<MaterializedState>
```

Implementation: §6.3 restoration with `T = local_seq(eventId)`.

Used for:

- App release pinning: bootstrap restores state at the manifest's `local_seq`, no live updates leak in.
- Data snapshots: mount opens with `data_at=$evt`, all queries route through `stateAt(data_room, $evt)`.
- Session snapshots: every mount in the snapshot is restored at its recorded event ID.
- Diff: `stateAt(room, A)` vs `stateAt(room, B)`, structural compare, render delta.

Reads are read-only restorations to a scratch space, not mutations of `state_current`. The live state continues to advance; the time-travel view is a frozen frame.

Cost is bounded by the gap between the target event and the nearest checkpoint. With 500-event default checkpoints, worst case is ~500 events of replay, which on IndexedDB is sub-100ms.

---

## 9. Capability API additions

The bootstrap's postMessage API gains storage-aware methods:

```typescript
// Live queries (current state)
read(roomId, eventType, filter?): Event[]
readState(roomId, eventType, stateKey): StateEvent
queryIndex(roomId, indexId, key?): IndexResult

// Time-traveled queries
readAt(roomId, eventId, eventType, filter?): Event[]
readStateAt(roomId, eventId, eventType, stateKey): StateEvent
queryIndexAt(roomId, eventId, indexId, key?): IndexResult

// Subscriptions (live tail)
subscribe(roomId, eventType, callback): Subscription
subscribeIndex(roomId, indexId, callback): Subscription

// Replay
replay(roomId, fromEventId, toEventId, callback): void

// Snapshots
//   scope ∈ {"app", "data", "session"}; see SPEC §5.2 for the three scopes.
snapshot(label: string, scope: "app" | "data" | "session"): Promise<EventId>
restore(snapshotEventId: EventId): Promise<void>
listSnapshots(scope: "app" | "data" | "session" | "all", roomId?: RoomId): Promise<SnapshotMetadata[]>

type SnapshotMetadata = {
  event_id: EventId
  scope: "app" | "data" | "session"
  room_id: RoomId
  label: string | null
  taken_at: number       // origin_server_ts of the snapshot event
  taken_by: UserId
  pinned: boolean        // user-created pins are sticky in the UI
}
```

`listSnapshots`: when `scope === "all"`, `roomId` is ignored and snapshots from every accessible room are returned. When `scope` is one of the three concrete scopes, `roomId` is required for `"app"` and `"data"` (selects the app or data room) and ignored for `"session"` (the session room is always the user's own).

Apps default to live queries. Time-traveled methods are used when the mount is pinned to a snapshot. Bootstrap routes transparently — the app calls `read(...)`, bootstrap chooses live or time-traveled based on the mount's pin state.

These methods are part of the canonical capability API surface in SPEC §6.2. Apps written against the base read/append/subscribe set continue to work; the time-travel, index, and snapshot-listing methods are additive.

---

## 10. Conflict and resync

### 10.1 Lost local_seq alignment

If `/sync` returns events whose `event_id`s indicate we're behind in a way our `next_batch` token didn't catch (e.g. the homeserver was restored from backup), the cache must resync:

1. Detect: an arriving event's `prev_events` reference event IDs not in our changelog.
2. Mark the room as `resync_required` in `sync`.
3. Backfill via `/messages?from=our_last_known&dir=f` until contiguous.
4. If backfill returns inconsistent data (different events at the same Matrix DAG position), mark the room as `forked` and surface to user. This is rare and usually indicates server-side incident.

### 10.2 Multi-device

Each device maintains its own cache. They are not synced peer-to-peer; they sync independently against the homeserver. A second device sees the same events in the same Matrix-DAG order, but its `local_seq` numbering is independent.

This means **`local_seq` is local-only**. It is never sent to other devices, never written into Matrix events, never used in capability API arguments visible to apps. Apps see Matrix `event_id`s. `local_seq` is a private optimization for IndexedDB queries.

Hydration (SPEC §21.4–§21.7) crosses devices via two paths with different reach: room-shared `m.room.hydration` events federate through Matrix to any device that can read the room; external hydration files travel out of band (USB, S3, IPFS, QR-code stream) and reach devices that may not share a homeserver at all. Local checkpoints (§6) never cross devices.

### 10.3 Encrypted rooms

For Megolm-encrypted rooms, raw ciphertext is stored in `events.content`. A `decrypted` parallel store, keyed `[room_id, event_id]`, holds plaintext when keys are available. If keys arrive late, decryption is retried and `decrypted` populated; `state_current` and `indexes_live` are recomputed for the affected event.

If keys are unavailable, the event is in the changelog but invisible to apps. Bootstrap surfaces "N events undecryptable" rather than silently dropping them.

---

## 11. Storage limits and eviction

### 11.1 Browser quotas

IndexedDB on the web is subject to origin storage quotas, typically ~60% of free disk on Chrome/Edge, smaller on Safari/Firefox. Khora must:

- Request persistent storage on first launch (`navigator.storage.persist()`).
- Track usage per room via `navigator.storage.estimate()` and surface in the audit / settings view.
- Evict gracefully when approaching quota: oldest unpinned checkpoints first, then media, then events with `_gap` markers around them.

### 11.2 User control

Settings → Storage shows:

- Total used / available
- Per-room breakdown
- Per-room policies (checkpoint frequency, retention)
- "Forget this room" (full local wipe; rejoinable)
- "Pin this room" (never evict, never compact)

Vault rooms default to `pin = true`. RSS-feed rooms default to aggressive eviction with on-demand backfill.

---

## 12. EO operator alignment

This table maps EO operators to the **local storage actions** they trigger. The protocol-level mapping (operator → Matrix event) is in SPEC §8 and is the canonical one. The entries below describe what happens *in the cache* when those Matrix events arrive; checkpoints in particular are a local-only construct and do not exist as Matrix events.

| Operator | Storage action (local cache) |
|---|---|
| `NUL ∅` | New room registered in `sync` with empty `events` |
| `DES ⊡` | Schema event written to `events` and projected to `state_current`; materializers initialized in `indexes_live` |
| `INS △` | Append to `events`, update `state_current` (if state) and `indexes_live` |
| `SEG \|` | Multiple rooms tracked independently; vault/bridge/roster pattern is just three rooms |
| `CON ⋈` | Cross-room reads (e.g. mount joining app room + data room state) |
| `SYN ∨` | Schema migration: union of old and new event types, materializer rebuild |
| `DEF ⊢` | The Matrix DEF event (e.g. `eo.user.snapshot`, schema-declared data snapshot, `m.room.app.release`) is written to `events`; bootstrap *also* writes a local checkpoint as a fast-restore optimization. Checkpoints are local-only — never sent to other devices, never federated |
| `EVA ⊨` | Restoration: `stateAt()` produces the materialized frame the app evaluates |
| `REC ↬` | The `events` store itself, in `local_seq` order |

`events` is REC ↬ made local. Everything else in the cache is derivation from REC ↬ — and therefore disposable, recomputable, auditable.

---

## 13. Invariants

The cache is correct iff:

1. **Determinism.** Replaying `events` for a room in `local_seq` order produces the same `state_current` and `indexes_live` every time, on every device, given the same schema.
2. **Recoverability.** Wiping `state_current`, `checkpoints`, and `indexes_live` and replaying `events` produces identical results to the pre-wipe state.
3. **Refetchability.** Wiping `events` for a room and re-`/sync`ing from genesis produces a changelog whose Matrix-DAG-ordered events match the original.
4. **Time-travel exactness.** `stateAt(room, eventId)` produces the same materialized state regardless of which checkpoint was used as the basis, within the constraint that events are present (no gaps between checkpoint and target).

These invariants are testable. CI should include a fuzz harness that generates synthetic event streams, applies them, snapshots, restores, and verifies determinism.
