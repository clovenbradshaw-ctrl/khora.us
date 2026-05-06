# Khora — Specification

**Status:** draft for repo overwrite
**Replaces:** prior single-app sketch
**Frame:** EO-native, Matrix-grounded

---

## 1. Purpose

Khora is no longer a single application. It is a **bootstrap shell and protocol** for running many applications — Khora-CM (case management), EO///DB, eoReader, eo-wiki, wire, NaiBOR, Anchorage — over a shared substrate of Matrix rooms. Apps and the data they operate on are independently authored, versioned, permissioned, and forkable. Users mount any compatible (app × data) pair at runtime.

The thing the repo previously called "Khora the app" becomes Khora-CM, one app among several. The thing the repo now becomes is the runtime everything else loads through.

---

## 2. Mental model

Three room kinds. That's the whole architecture.

| Kind | Holds | Example |
|---|---|---|
| **App room** | Executable code (HTML/JS/CSS), manifest, release history | `#khora-cm-app:michael.tld` |
| **Data room** | Content events, schema declaration, permissions | `#case-files-2026:michael.tld` |
| **User room** | Mounts, preferences, personal snapshots | `#user-mq:michael.tld` (per user) |

A running session is a triple: `(app_room, data_room, user_room)`. Bootstrap composes them; the iframe sandbox enforces the boundary.

---

## 3. App rooms

### 3.1 Designation

A room becomes an app room by emitting a `m.room.app` state event with empty `state_key`:

```json
{
  "type": "m.room.app",
  "state_key": "",
  "content": {
    "app_id": "khora-cm",
    "display_name": "Khora Case Management",
    "current_manifest": "$evt_id_of_latest_manifest",
    "accepts_schemas": ["eo.case.v1", "eo.case.v2"],
    "fork_of": null
  }
}
```

This is a `DES ⊡` operator at the room site, resolution = `app`.

### 3.2 Manifest events

Each release writes a versioned manifest as a numbered state event:

```json
{
  "type": "m.room.app.manifest",
  "state_key": "v1.4.0",
  "content": {
    "version": "1.4.0",
    "code": {
      "primary_uri": "mxc://michael.tld/AbC123...",
      "fallback_url": "https://cdn.michael.tld/khora-cm/v1.4.0.html",
      "size_bytes": 234567,
      "sha256": "9f86d081...",
      "integrity": "sha256-9f86d081..."
    },
    "accepts_schemas": ["eo.case.v1"],
    "released_at": "2026-05-06T14:00:00Z",
    "released_by": "@michael:michael.tld",
    "previous_manifest": "$prev_evt_id",
    "changelog": "Fixed cursor/witness conflation. Added DEF tagging for case files.",
    "permissions_required": ["read_data", "append_data", "subscribe_data"],
    "source": {
      "repo": "https://github.com/michael/khora",
      "commit": "a1b2c3d4e5f6...",
      "tag": "v1.4.0",
      "build_log": "https://github.com/michael/khora/actions/runs/12345"
    }
  }
}
```

Bootstrap **MUST** verify `sha256` against fetched bytes before executing. The hash is the link between the manifest's claim and the code's actuality — without verification, the manifest is just gossip.

The `source` block is **optional**. When present, it lets a verifier walk: manifest → repo at commit → CI build log → bytes whose hash matches. A hand-published app room with no repo is still legitimate. See §15 for the repo↔room model and the publish pipeline.

This is `INS △` at site = app room, resolution = release.

#### 3.2.1 Layout-renderer manifest variant

Tier 0 layout-only apps (§19.1) use an additive manifest variant. Instead of `code: { primary_uri, sha256, ... }`, the manifest carries a built-in renderer reference:

```json
"code": {
  "renderer": "khora-layout-renderer",
  "layout_room": "!data-room:server",
  "layout_state_key": ""
}
```

Bootstrap recognizes the `renderer` field, instantiates the named built-in (no `mxc://` fetch, no `sha256` verification — there is no fetched code), and points it at the layout state event in the named data room. The trust chain reduces to "does this user know the renderer ID we ship?" Built-in renderer IDs are part of bootstrap's release surface; adding new ones is a bootstrap-version bump, not an app concern.

### 3.3 Large bundles

If `size_bytes` exceeds the homeserver media cap (typically 50–100MB) or a published threshold, manifest specifies:

- `primary_uri`: mxc:// reference, federated, falls under Matrix authenticated media
- `fallback_url`: external HTTPS URL (R2, Cloudflare, IPFS gateway, Arweave)
- `parts`: optional array for split bundles, each with own hash

```json
"code": {
  "parts": [
    {"primary_uri": "mxc://...", "sha256": "...", "size_bytes": 49000000, "order": 0},
    {"primary_uri": "mxc://...", "sha256": "...", "size_bytes": 12000000, "order": 1}
  ],
  "concatenated_sha256": "...",
  "size_bytes": 61000000
}
```

Bootstrap concatenates parts in order, verifies the combined hash, then evaluates.

The same `mxc` + `sha256` + `parts` shape generalizes from app code to data events of any kind — large note bodies, attachments, dashboard layouts, hydration bundles. See §21 for the data-event generalization.

### 3.4 Releases as DEF snapshots

A `m.room.app.release` event is `DEF ⊢` at site = manifest:

```json
{
  "type": "m.room.app.release",
  "state_key": "stable",
  "content": {
    "manifest": "$manifest_evt_id",
    "channel": "stable",
    "tagged_at": "...",
    "tagged_by": "@michael:michael.tld"
  }
}
```

Channels: `stable`, `beta`, `canary`, or arbitrary user-defined. The `current_manifest` pointer in `m.room.app` is shorthand for "stable channel's latest tag." Bootstrap consults whichever channel the user requested.

### 3.5 Forking

Forking is creating a new app room with `fork_of` set:

```json
{
  "type": "m.room.app",
  "content": {
    "app_id": "khora-cm-mike-fork",
    "fork_of": {
      "room_id": "!original:michael.tld",
      "manifest_event": "$forked_from_manifest"
    },
    ...
  }
}
```

Fork relationships are visible from outside both rooms. A registry room (see §7) can index forks for discovery. Merging forks is `SYN ∨`: a new manifest in either room declaring `merged_from: [$other_manifest_event]`. The merge is by convention; Matrix doesn't enforce it. The audit trail does.

---

## 4. Data rooms

### 4.1 Schema declaration

A data room declares its schema as a state event:

```json
{
  "type": "m.room.data_schema",
  "state_key": "",
  "content": {
    "schema_id": "eo.case.v1",
    "schema_version": "1.0.0",
    "display_name": "Case Files",
    "event_types": [
      {"type": "eo.case.note", "operator": "INS", "min_pl": 50},
      {"type": "eo.case.evidence", "operator": "INS", "min_pl": 50},
      {"type": "eo.case.tag", "operator": "DES", "min_pl": 50},
      {"type": "eo.case.link", "operator": "CON", "min_pl": 50},
      {"type": "eo.case.snapshot", "operator": "DEF", "min_pl": 100}
    ],
    "indexable_fields": ["case_id", "tags", "created_at"],
    "previous_schema": null
  }
}
```

Apps consult this on join. If the app's `accepts_schemas` doesn't include `schema_id` (or a compatible major version), bootstrap refuses to mount and surfaces the mismatch.

### 4.2 Data events

Every data event embeds the EO triple in `content.eo`:

```json
{
  "type": "eo.case.note",
  "content": {
    "eo": {
      "operator": "INS",
      "site": "case:metro-watchdog-2026",
      "resolution": "appended"
    },
    "payload": {
      "title": "Source phone log",
      "body": "...",
      "tags": ["NDP", "Solaren"]
    }
  }
}
```

Schema validates `payload`; the EO triple is uniform across all schemas. This means generic tools (timeline visualizers, snapshot diffs, EO operator counters) work over any data room, regardless of payload schema.

Payloads above the per-event size budget rely on schema-declared `externalizable_fields[]` to reference media by `mxc://` + `sha256` rather than inlining bytes. See §21 for the externalization rules and the hydration paths that let new devices, offline peers, and air-gapped recipients bootstrap a room from a single bundle.

The full set of guarantees a successful write satisfies — schema validation, EO-triple injection, permission check, local-first changelog, externalization of over-threshold fields, idempotency, audit, P2P propagation — is in §20 (the write contract). Apps do not implement these; bootstrap enforces them on every `append`.

### 4.3 Permissions live on the data room

Power levels, history visibility, and E2EE are properties of the data room, not the app. The same eoReader binary handles a public corpus and a Megolm-encrypted vault — it just gets back ciphertext or a 403 in the latter case. **App code cannot weaken data-room permissions.**

Recommended per-room patterns:

- **Public corpus**: `world_readable` history, PL 0 to write, PL 50 to DEF, PL 100 for schema changes.
- **Member corpus**: `invited` history, invite-only join, otherwise as above.
- **Vault**: Megolm encryption on, small membership, schema declared once and never changed.

### 4.4 Schema evolution

Additive changes (new event types, new optional payload fields) advance `schema_version` minor; old apps continue to work, ignoring unknown event types. Breaking changes mint a new `schema_id` and either:

- Migrate to a new room, or
- Coexist in the same room as parallel schema (rare; messy)

Migrate-to-new-room is the default. A `m.room.data_schema_migration` state event in the old room points to the new room. Apps following migrations is a UX problem, not a protocol problem.

---

## 5. User rooms

Each user has a private room — typically `#user-{handle}:server`, `world_readable: invited`, member list = self only — that holds their session state.

### 5.1 Mount events

```json
{
  "type": "eo.user.mount",
  "state_key": "khora-cm/case-files-2026",
  "content": {
    "app_room": "!khora-cm-app:michael.tld",
    "app_channel": "stable",
    "app_manifest_pinned": null,
    "data_room": "!case-files-2026:michael.tld",
    "data_schema_required": "eo.case.v1",
    "mounted_at": "2026-05-06T14:30:00Z",
    "preferences": {
      "view": "timeline",
      "filters": ["tag:NDP"]
    }
  }
}
```

`app_manifest_pinned` (when set) freezes the user to a specific app version. `null` = follow channel.

### 5.2 Snapshots and reversibility

Three snapshot scopes:

| Scope | Event type | Captures |
|---|---|---|
| App | `m.room.app.release` (in app room) | A code version |
| Data | Schema-declared snapshot event type, e.g. `eo.case.snapshot` for `eo.case.v1` (in data room) | A point in the data timeline |
| Session | `eo.user.snapshot` (in user room) | Mounts, prefs, scroll position, app+data event IDs at the moment |

The data-snapshot event type is **schema-specific**: each `m.room.data_schema` (§4.1) declares one event type marked `operator: DEF` to serve as the snapshot. Generic tooling reads the EO triple uniformly; the type name varies.

A session snapshot:

```json
{
  "type": "eo.user.snapshot",
  "content": {
    "label": "Investigation review, May 6",
    "mounts": [
      {
        "app_room": "!khora-cm-app:...",
        "app_manifest_event": "$abc...",
        "data_room": "!case-files-2026:...",
        "data_head_event": "$xyz..."
      }
    ],
    "previous_snapshot": "$prev..."
  }
}
```

Restoring a snapshot is bootstrap re-mounting with `app_manifest_pinned` and `data_head_event` set. The data room hasn't moved — `/state` and `/messages` at `data_head_event` give back exactly the substrate as it was at snapshot time. This is `EVA ⊨` at a frozen frame. Reproducible scholarship as a triple of event IDs.

**Reversibility** is automatic: every state event has `prev_content`, every change is a Matrix event, the user's room is a complete REC ↬ of their interactions. "Undo" is re-emitting `prev_content`. "Time travel" is `/state?at=$evt`.

---

## 6. Bootstrap shell

Lives at a stable origin (e.g. `app.michael.tld`). Single source of executable trust in the system.

### 6.1 Responsibilities

- Matrix auth (login, token refresh, OIDC if/when ready)
- Mount UI: lists user's mounts from their user room, offers compatible (app × data) pairs from registries
- Iframe creation with `sandbox="allow-scripts"` (no `allow-same-origin`)
- Hash verification of fetched app code
- postMessage capability API
- Audit log: every cross-frame call recorded as event in user room (configurable)

### 6.2 Capability API

The full set of methods bootstrap exposes via postMessage. This is the authoritative list — STORAGE.md and §17.4 elaborate on backing storage and option semantics, but every method below is part of §6.2.

```typescript
// --- Live queries (current state) ---
read(roomId, eventType, filter?): Promise<Event[]>
readState(roomId, eventType, stateKey): Promise<StateEvent>
queryIndex(roomId, indexId, key?): Promise<IndexResult>

// --- Time-traveled queries (state at an event) ---
readAt(roomId, eventId, eventType, filter?): Promise<Event[]>
readStateAt(roomId, eventId, eventType, stateKey): Promise<StateEvent>
queryIndexAt(roomId, eventId, indexId, key?): Promise<IndexResult>

// --- Writes ---
append(roomId, eventType, content): Promise<EventId>

// --- Subscriptions (live tail) ---
subscribe(roomId, eventType, callback): Subscription
subscribeIndex(roomId, indexId, callback): Subscription

// --- Replay (deterministic walk over a range) ---
replay(roomId, fromEventId, toEventId, callback): void

// --- Media ---
resolveMedia(mxcUri): Promise<Blob>

// --- Snapshots (DEF at a chosen scope) ---
//   scope ∈ {"app", "data", "session"}; see §5.2 for the three scopes.
snapshot(label, scope): Promise<EventId>
restore(snapshotEventId): Promise<void>
listSnapshots(scope, roomId?): Promise<SnapshotMetadata[]>

// --- Hydration (§21.4–§21.7) ---
//   exportHydration produces an encrypted bundle for off-Matrix transport;
//   importHydration replays one back through the §20 write contract.
exportHydration(scope, options): Promise<{ bytes: Uint8Array, sha256: string, key_fingerprint: string }>
importHydration(bytes: Uint8Array, key: KeyMaterial): Promise<{ rooms_imported: RoomId[], events_replayed: number, conflicts: ConflictRecord[] }>

// --- Standard cross-app options (§17.4) ---
//   key drawn from the frozen vocabulary in §17.4; persisted in user room.
getOption<T>(key): Promise<T>
setOption<T>(key, value): Promise<void>
subscribeOption<T>(key, callback): Subscription

// --- Transport diagnostic (§18.5) ---
//   Read-only. Apps may surface but must not branch semantics on it.
getTransport(): Promise<TransportInfo>
getTransportFor(roomId): Promise<TransportInfo>

type SnapshotMetadata = {
  event_id: EventId
  scope: "app" | "data" | "session"
  room_id: RoomId
  label: string | null
  taken_at: number
  taken_by: UserId
  pinned: boolean
}
```

Bootstrap rejects calls outside the app's mount scope. The app cannot read tokens, cannot reach unmounted rooms, cannot widen permissions. The app can be killed by closing the iframe.

**Transport-transparent.** The same call returns the same shape whether the data arrives via federation, an embedded homeserver, a direct WebRTC channel, the LAN, or a sneakernet import. P2P is bootstrap's responsibility (§18); apps are not aware of the transport stack.

**Write-correct.** Every `append` satisfies the eleven guarantees in §20 — schema validation, EO-triple handling, permission check, local-first changelog write, externalization of over-threshold fields (§21), server confirmation with idempotency, encryption when applicable, read-your-writes, P2P propagation, and audit-log capture. The contract spans every entry path (hand-coded apps, Tier 0 dashboards, Tier 1 scaffolds, `<ImportView>`, CLI tools, and `importHydration` from external bundles — see §19, §21.7).

The local storage substrate that backs `read`, `subscribe`, and the time-travel variants is specified in [STORAGE.md](./STORAGE.md). The cross-app option vocabulary is fixed in §17.4. The transport diagnostic semantics are in §18.5.

### 6.3 Capability scoping

Each iframe receives a capability bundle on init:

```json
{
  "app_room": "!khora-cm-app:...",
  "app_manifest": "$abc...",
  "mount": {
    "data_room": "!case-files-2026:...",
    "data_schema": "eo.case.v1",
    "permissions": ["read", "append", "subscribe"]
  },
  "user_room_writable": false
}
```

Bootstrap enforces `permissions` on every API call. App cannot, e.g., `append` if its mount permissions don't include it.

---

## 7. Registries

Discovery is a room. A `m.room.registry` state event designates a room as a registry; entries are state events keyed by alias:

```json
{
  "type": "m.room.registry.entry",
  "state_key": "khora-cm",
  "content": {
    "kind": "app",
    "room": "!khora-cm-app:michael.tld",
    "display_name": "Khora Case Management",
    "description": "...",
    "added_at": "...",
    "added_by": "@michael:michael.tld"
  }
}
```

Two recommended registries:

- `#apps:michael.tld` — public apps directory
- `#corpora:michael.tld` — public data rooms with schema metadata

Forks add their own registry entries; the registry's power levels determine who can list. Anyone can run their own registry; the protocol does not privilege any single one.

---

## 8. EO operator mapping

| Operator | Matrix event |
|---|---|
| `NUL ∅` | Room creation (`m.room.create`) |
| `DES ⊡` | Designation state events: `m.room.app`, `m.room.data_schema`, `m.room.registry` |
| `INS △` | Append: manifest, data event, mount, snapshot |
| `SEG \|` | Splitting: vault/bridge/roster pattern, schema migration to new room |
| `CON ⋈` | Join: membership, mount (app × data), registry entry |
| `SYN ∨` | Merge: fork merge via `merged_from`, schema-additive minor versions |
| `DEF ⊢` | Tag: `m.room.app.release`, data snapshot, session snapshot |
| `EVA ⊨` | Bootstrap evaluating manifest+data+session at chosen event IDs |
| `REC ↬` | The room timeline itself (`/messages`, `/state?at=`) |

Every event in the system carries `content.eo.{operator, site, resolution}`. Generic tooling reads this without knowing the schema.

---

## 9. Repo layout

```
khora/
├── README.md                  # rewritten: "Khora is a bootstrap, not an app"
├── SPEC.md                    # this document
├── CHANGELOG.md
│
├── bootstrap/                 # the shell at app.michael.tld
│   ├── index.html
│   ├── src/
│   │   ├── auth.ts
│   │   ├── loader.ts          # fetches manifest, verifies hash, creates iframe
│   │   ├── capability.ts      # postMessage API
│   │   ├── sandbox.ts         # iframe lifecycle
│   │   ├── snapshot.ts
│   │   ├── registry.ts        # discovery UI
│   │   └── mount.ts           # (app × data) pairing
│   └── tests/
│
├── apps/                      # apps that ship with Khora (each independently publishable)
│   ├── khora-cm/              # was the old "Khora app"; now one app among many
│   ├── eodb/                  # EO database workbench
│   ├── eoreader/
│   ├── eo-wiki/
│   ├── wire/
│   └── anchorage/
│
├── schemas/                   # JSON schemas for protocol events
│   ├── m.room.app.json
│   ├── m.room.app.manifest.json
│   ├── m.room.app.release.json
│   ├── m.room.data_schema.json
│   ├── m.room.data_schema_migration.json
│   ├── m.room.registry.json
│   ├── m.room.registry.entry.json
│   ├── m.room.instance.json
│   ├── eo.user.mount.json
│   ├── eo.user.snapshot.json
│   ├── eo.user.preferences.v1.json
│   └── khora.json              # repo-side config for create-from-repo (§16.5)
│
├── data-schemas/              # well-known data schemas
│   ├── eo.case.v1.json
│   ├── eo.corpus.v1.json
│   ├── eo.feed.v1.json
│   └── eo.eodb.v1.json
│
├── tools/                     # CLI tools
│   ├── publish.ts             # upload app code, write manifest, tag release
│   ├── publish-from-ci.ts     # CI-side publish (§15.2)
│   ├── fork.ts                # create fork app room
│   ├── snapshot.ts            # tag snapshot at any scope
│   ├── mount.ts               # add a mount to a user room
│   ├── verify.ts              # verify a running app against its manifest
│   └── create-khora-app/      # `npx create-khora-app <name>` (§19.2)
│
└── templates/                 # starter repos for create-khora-app
    ├── table/                 # <TableView> over a chosen schema
    ├── kanban/                # <KanbanView>
    ├── calendar/              # <CalendarView>
    ├── graph/                 # <GraphView>
    ├── timeline/              # Horizon-style timeline
    ├── blocks/                # composable @khora/ui blocks
    └── custom/                # bare scaffold; bring your own components
```

The layout shows the **final state**. Everything under `bootstrap/`, `tools/`, and the published schemas in `schemas/` and `data-schemas/` are Phase 0+ deliverables; see the corresponding READMEs for current status.

---

## 10. Phased implementation

**Phase 0 — Protocol freeze (1 week)**
Lock the schemas for §3 (app rooms), §4 (data rooms), §5 (user rooms), §6.2 (capability API), §14.4 (`m.room.instance`), §15.5 (manifest `source` block), and §17.4 (`eo.user.preferences.v1`). Define `khora.json` (§16.5). Write JSON schemas in `schemas/`. Regression tests against example events. No code yet.

**Phase 1 — Bootstrap MVP (2 weeks)**
Auth, manifest fetch, hash verification, iframe creation, capability API for `read` and `subscribe` only. No write path. No snapshots. Mount one trivial demo app from a hardcoded room.

**Phase 2 — First real app: wire (1 week)**
Port wire to load from a Matrix app room, read RSS items from a public data room. Read-only, exercises §3 + §4 + §6 end to end without write complexity.

**Phase 3 — Write path + user rooms (2 weeks)**
`append` capability, user room creation, mount events. Add eo-wiki as second app since it tests writes. At this point Khora-CM is unblocked.

**Phase 4 — Snapshots and time travel (1 week)**
DEF events at all three scopes. Restore from snapshot. UI for browsing snapshot history.

**Phase 5 — Forking and registries (1 week)**
`fork_of`, registry rooms, discovery UI, schema migration scaffold.

**Phase 6 — Port Khora-CM (2 weeks)**
The old single-app Khora becomes Khora-CM running on the new bootstrap. Vault/bridge/roster room pattern preserved as the data side. This is the migration that retires the old code path.

**Phase 7 — Port EO///DB, eoReader, Anchorage (3+ weeks)**
Each gets its own app room, declares schema compat. EO///DB's nine-operator fold becomes a generic schema operating on any EO data room.

**Phase 8 — Direct P2P transports (3 weeks)**
Embedded homeserver (Conduit-WASM or equivalent), WebRTC data channel, signaling-room discovery. Capability API gains `getTransport` / `getTransportFor` (§18.5). Apps require no changes; existing apps inherit P2P automatically.

**Phase 9 — Local and offline transports (2 weeks)**
mDNS LAN discovery, sneakernet export/import, full offline-first audit pass. Closes out §18 surface.

---

## 11. Constraints, gaps, known unknowns

- **Matrix tokens are unscoped.** Bootstrap's iframe sandbox is doing real load-bearing work. A bug there is a credential leak. Audit this surface harder than anything else. Consider a read-only proxy in front for high-stakes deployments.
- **State event 64KB cap** means manifests can't inline anything substantial. All app code goes through media (§3.3). The same cap applies to data events; §21 generalizes the externalization pattern (`mxc://` + `sha256` + per-blob encryption) to any schema-declared field over a threshold and adds hydration bundles so new devices and offline peers bootstrap fast.
- **Authenticated media (MSC3916)** changed the game in late 2024. Bootstrap must use `/_matrix/client/v1/media/download/...` with `Authorization` header, not the deprecated unauthenticated endpoints. mxc:// resolution is a privileged operation that only bootstrap performs; apps receive `Blob` URLs.
- **Federation lag.** A manifest event in a remote room may not have propagated when bootstrap tries to read it. Retry with backoff; surface the wait.
- **Schema versioning** is the place this design will hurt first. Treat breaking changes as new rooms. Do not try to be clever about in-place schema migration in v1.
- **Homeserver SPOF.** Mirror critical app rooms to a second homeserver. The protocol supports this naturally (federation); we just have to actually do it. P2P transports (§18) close the rest of the gap once Phase 8 ships — embedded homeservers and direct WebRTC let users keep working when no remote homeserver is reachable.
- **Discovery is social, not technical.** Registries are rooms. Whose registry counts is a governance question, not a protocol question. This is correct (Ostrom), but it means there's no out-of-the-box "app store" — building trust around specific registries is part of the work.

---

## 12. Non-goals

- App-to-app direct communication. Apps are sandboxed; cross-app composition happens at the data layer (mount the same data room from two apps), not at the code layer.
- A package manager. Apps are not modules; they're fully-loaded HTML payloads. Sharing code between apps is done by sharing source repos, not by bootstrap.
- Server-side rendering. Bootstrap is a client. If you want SSR, that's a different system.
- Replacing Matrix homeservers. Khora is a thin protocol on top of Matrix. Synapse, Conduit, Dendrite — any conformant homeserver works.

---

## 13. EO frame note

Khora the bootstrap is the **DEF frame** for the system: it defines what counts as an app, what counts as data, what counts as a mount, what counts as a snapshot. The rooms are the **substrate** (REC ↬). Users at runtime perform **EVA ⊨**: applying the frame to the substrate and producing a rendered, interactive view.

The split between app rooms and data rooms is the split between *frame* and *substrate* made concrete in Matrix's own typing. That this falls out of the Matrix primitives without forcing is the strongest evidence that the protocol fits the philosophy.

---

## 14. Subscriptions and shared instances

This section refines §5 and §7 with the user-facing model. The protocol primitives don't change; the framing does.

### 14.1 Khora as master app

Users authenticate to **Khora itself** — the bootstrap origin — the same way they'd sign in to a workspace product. Once authenticated, the things they see and act on are:

- **Apps** they have access to (code, from app rooms)
- **Subscriptions** they hold (mounts, in their user room)
- **Instances** they belong to (shared (app × data) pairs they were invited into)

Khora is not the substrate. It is the master app *over* the substrate. The substrate is Matrix.

### 14.2 Subscriptions

A **subscription** is a user-facing label for what §5.1 calls a `eo.user.mount`. The protocol-level event is unchanged; the term reflects what the user is doing: subscribing to a dataset under a particular app.

A user subscribes to a data room — for a specific app, at a specific channel — by writing a mount event into their user room. They unsubscribe by clearing the state event (writing empty `content`). Subscriptions are reversible without loss; the data room is untouched.

Subscriptions are **personal**: they live in the user's user room. Two users mounting the same `(app, data)` pair each have their own subscription event. The data they see is whatever the data room's permissions grant them.

### 14.3 Instances

An **instance** is the runtime composition `(app_room, data_room)`. Each subscription resolves to an instance at session time.

Conceptually, an instance is the unit a user thinks of as "their CRM" or "the case file for X." Mechanically, it's whatever bootstrap mounts when the subscription fires.

### 14.4 Instance spaces (sharing)

To share an instance — to do the equivalent of "invite a teammate to this Airtable base" — wrap the `(app_room, data_room)` pair in a Matrix **Space**:

```json
{
  "type": "m.room.instance",
  "state_key": "",
  "content": {
    "instance_id": "case-files-2026/khora-cm",
    "display_name": "Metro Watchdog Investigation",
    "app_room": "!khora-cm-app:michael.tld",
    "app_channel": "stable",
    "data_room": "!case-files-2026:michael.tld",
    "auto_subscribe_on_join": true
  }
}
```

The space carries `m.space.child` references to both the app room and the data room. Members of the space have membership in both children (granted by space invite, subject to each child's own join rules and power levels — bootstrap does not bypass them).

When a user accepts an invite to an instance space, bootstrap detects the `m.room.instance` state event and offers to **auto-subscribe**: write the matching `eo.user.mount` into the user's user room. The invite is the trigger; the subscription is the result.

This is `CON ⋈` at the space site, resolution = `instance`.

### 14.5 Roles within an instance

Power levels inside the instance space, propagated to the data room, define roles:

| Role | Typical PL on data room | Capabilities |
|---|---|---|
| Viewer | 0 (read only) | `read`, `subscribe`, no `append` |
| Contributor | 50 | `read`, `subscribe`, `append` |
| Editor | 75 | All of contributor + `DEF` (snapshot/tag) |
| Owner | 100 | All of editor + schema changes, member admin |

App code never decides who can write. The data room does. App UI may *hide* the contribute button when a user lacks `append`, but the homeserver is the enforcement boundary.

### 14.6 Sharing the app vs sharing data

These are distinct grants:

- **Sharing the app**: invite into the app room. The invitee gains the right to fetch the code (read manifests, resolve media). Useful for private/closed-source apps. For public apps, no invite is needed — the app room is `world_readable`.
- **Sharing data**: invite into the data room (or into an instance space that contains it). The invitee gains the right to read/write the dataset under whatever app they choose to mount, including forks.

An instance space invite typically does both at once. But they decouple cleanly when needed: a public app + a private data room is the common case (everyone has Khora-CM; only your team has your case files).

### 14.7 Subscription lifecycle

```
discover → subscribe → mount → use → snapshot → unsubscribe
```

- **Discover**: through a registry, an instance-space invite, or a direct link
- **Subscribe**: write `eo.user.mount` into user room
- **Mount**: bootstrap composes the iframe at session time
- **Use**: app reads/writes via capability API, scoped to mount permissions
- **Snapshot**: optional `eo.user.snapshot` for reproducibility
- **Unsubscribe**: clear the mount state event; user retains snapshots; data room is untouched

Leaving an instance space additionally drops membership in the underlying app and data rooms — clean teardown without protocol gymnastics.

### 14.8 Mental-model crosswalk

| Khora term | CRM/Airtable equivalent | Matrix primitive |
|---|---|---|
| Master app (Khora) | The product you log into | Bootstrap origin |
| App | The product's UI/feature set | App room + manifest |
| Dataset | A base / workspace | Data room + schema |
| Subscription | "Open this base in this view" | `eo.user.mount` state event |
| Instance | A specific (app, base) you're working in | `m.room.instance` space |
| Invite to an instance | Share a base with a collaborator | Matrix space invite |
| Role on an instance | Owner / Editor / Commenter / Viewer | Power levels on the data room |
| Snapshot | Restore-point / version history | DEF events at app, data, or session scope |

The crosswalk is intentional. The Airtable/CRM mental model is what users have. The Matrix primitives are what the protocol delivers. Khora is the translation layer that makes them line up without anyone holding a token they shouldn't.

---

## 15. Repo and room: development vs execution

GitHub plays a real role in this architecture, but a constrained one — and getting the constraint right is the whole point. The repo is **source**, the Matrix room is **release**. Conflating them recreates exactly the centralization problem this architecture exists to dissolve.

### 15.1 Source of truth for development, not for execution

The repo is where the app is *written* — version control, CI, code review, issue tracking, branches, the whole apparatus humans need to actually develop software. The Matrix room is where the app is *run from*. Bootstrap never reads from GitHub. It reads the manifest from the app room, fetches the bundle from `mxc://` (or external fallback), verifies the hash, executes. **If GitHub disappears tomorrow, the app keeps loading.**

This matters because the political economy of the system depends on it. Anyone can mirror the repo. Anyone can fork the app room. Anyone can run their own homeserver. There is no single point at which the system can be taken down by removing one party. Putting GitHub on the execution path would undo that.

### 15.2 CI as the publish step

The pipeline that makes this work:

```
git tag v1.4.0
  → GitHub Actions builds the bundle
  → computes sha256
  → uploads to homeserver via /upload
  → writes m.room.app.manifest event with mxc + hash
  → writes m.room.app.release event tagging the channel
  → optionally mirrors bundle to R2/IPFS/Arweave for fallback_url
```

The bot account that does this has PL 100 in the app room. Its credentials live in CI secrets. Releases become reproducible from the git tag — anyone with the repo and a homeserver can verify that `v1.4.0` builds to the bytes that hash to what the manifest claims.

The canonical workflow lives at `apps/<app>/.github/workflows/publish.yml` (one per app). The reusable script is `tools/publish-from-ci.ts`.

### 15.3 What the repo encodes that the room cannot

Some things git is genuinely better at than Matrix:

- **Line-level history of source.** Matrix's `prev_content` gives you state-event-level diffs, which is the wrong granularity for code review. Git diffs are the right tool.
- **Issues and PRs.** Pre-publication discussion. Once a release is tagged, the conversation that produced it is in the repo.
- **Branches.** Pre-fork experimentation that may never become a published app. Cheap in git, expensive in Matrix (every branch ≈ a new room).
- **Build reproducibility.** Lock files, Dockerfiles, the whole build environment. The manifest's `sha256` is a claim; the repo is what makes the claim checkable.

### 15.4 What the room encodes that the repo cannot

Some things Matrix is better at:

- **Federation and offline replay.** The room works without internet to GitHub.
- **Permissioned data adjacent to the app.** Nothing in git equates to a Megolm-encrypted vault.
- **User mounts and sessions.** GitHub has no concept of "I ran this app against this data on this date."
- **Forking that includes the release pipeline.** A git fork is source; an app room fork is source + release identity + user mounts pointing at it. Different beasts.

### 15.5 Manifest `source` block

To make the repo↔room link auditable, `m.room.app.manifest` accepts an optional `source` block (introduced in §3.2):

```json
"source": {
  "repo": "https://github.com/michael/khora",
  "commit": "a1b2c3d4e5f6...",
  "tag": "v1.4.0",
  "build_log": "https://github.com/michael/khora/actions/runs/12345"
}
```

A verifier walks: manifest claims → repo at this commit → CI built it → hash matches. If any step fails, the manifest is suspect. None of these fields are required — a hand-published app room with no repo is still legitimate — but when they're present, the trust chain is checkable end to end.

### 15.6 Forks across both layers

The interesting case. Someone forks Khora-CM:

1. Fork the repo on GitHub. (Standard.)
2. Run their own publish pipeline pointed at *their* app room.
3. Their app room has `fork_of` pointing at yours.
4. Their manifest's `source.repo` points at their fork.

A user inspecting two app rooms can see: same upstream commit, divergent commits since, divergent release histories. Both run the same way through bootstrap. Neither has authority over the other. The fork is fully realized at both layers — code and execution — without any central registry blessing it.

### 15.7 The repo as registry seed

A `khora-apps` meta-repo can publish a JSON file listing well-known app rooms — effectively a default registry that bootstrap can ship with as a seed. Users override or replace it freely. This is the same role npm registry plays for Node, except: nothing in the protocol depends on it, anyone can run their own, and the registry itself is just a JSON file in a public repo (or a registry room in Matrix; SPEC §7).

### 15.8 Honest tension: the build environment is centralized

GitHub Actions is a single vendor. If you care about the trust chain being *fully* decentralized, the publish step is the weakest link — the vendor could censor or alter a build, and the manifest would still hash-verify because the hash is computed by the build itself. Mitigations:

- **Multi-CI signatures.** Publish from multiple CI providers (GHA + Forgejo Actions + local) and require N-of-M signatures on releases.
- **Reproducible builds.** Anyone can rebuild from the commit and verify the bytes match.
- **Document verification procedure.** For high-stakes apps (Khora-CM with vault data, Anchorage with source identities), require reproducible builds and document the verification procedure.

For Ground Truth's investigative apps this matters. For wire and eo-wiki it probably doesn't. The protocol does not prescribe a single answer; it makes the tradeoff legible per app.

### 15.9 The deeper read

The repo is the **DEF frame for development** — it defines what counts as a contribution, a review, a release candidate. The room is the **DEF frame for execution** — it defines what counts as a running version, an authoritative release, a mounted app. Two frames, related but distinct, each with their own substrate. The handoff between them is the publish event, and `source` in the manifest is what makes that handoff legible from either side.

Treat the repo as the development surface and the room as the runtime surface, and never let those wires cross.

---

## 16. Bootstrap UX surface

This section describes the surface the user sees inside the bootstrap. It is normative for the reference bootstrap; alternative bootstraps may diverge so long as they preserve the protocol contracts in §1–§15.

### 16.1 Three top-level surfaces

Three top-level surfaces, each doing one thing:

- **Mounts** — home, what you actively use
- **Library** — find: apps and data
- **History** — revisit: snapshots and audit

The four actions a user might want — find/add, fork, create from repo, subscribe — are variations on a single shape: acquire a Matrix room reference, subscribe to it, optionally produce derivatives.

### 16.2 Home — launcher of mounts

After login, tiles. Each tile is one `(app × data)` pair the user has configured. App icon, app name, data room name underneath in smaller text, a pin glyph if version-locked, a dot if there's unread activity in the data room. Tap → iframe opens. Bottom: "+" for new mount.

The deliberate move: "installed app" isn't a tile. **Mounts are.** In this system, having an app and having data are independent acquisitions; the app does nothing alone. Surfacing only mounts on home reinforces that the unit of *use* is the pair, not either piece.

### 16.3 Library — apps

Reached from "+" or a Library tab. Fed by registry rooms — a small seed registry shipped in bootstrap, plus any registries the user has added. Each registry is a row in settings, on/off-able, with badges on apps showing source.

Each app card:

```
khora-cm                                    [stable v1.4.0]
Khora Case Management
Sovereign case management for journalists and lawyers.
↳ accepts: eo.case.v1
↳ source: github.com/michael/khora • commit a1b2c3d
[ Install ] [ Pin version ] [ Fork ]
```

- **Install** — subscribes to the app room; nothing executes.
- **Pin version** — subscribes but locks to a specific manifest hash regardless of channel updates.
- **Fork** — opens the fork modal (§16.4).

Always available alongside browse: an **"Add by URI"** input. Accepts room aliases (`#khora-cm-app:michael.tld`), room IDs, or a custom `mxapp://michael.tld/khora-cm` scheme. Same install flow as browse. This is where power users live and where shared links land.

### 16.4 Forking

From any app card → **Fork** → modal with three fields:

1. **Publish to** — defaults to a "Khora Apps" community room on the user's homeserver (created on first fork if absent). Power users override.
2. **Repo** — optional GitHub URL of a forked source repo. If provided, gets written to the new manifest's `source` block (§3.2, §15.5). If not, fork is identity-only — the new app room is code-identical to upstream but the user controls releases.
3. **Initial channel** — usually `stable` with upstream's current manifest hash copied as the user's first release.

Result: new app room, user at PL 100, `fork_of` set (§3.5). The Library shows it tagged "fork of khora-cm." Mounts using upstream get a "switch to fork?" hint (declinable).

### 16.5 Creating from repo

"+" → **Create app from repo** → paste GitHub URL.

Bootstrap looks for `khora.json` in the repo root:

```json
{
  "app_id": "my-tool",
  "display_name": "My Tool",
  "accepts_schemas": ["eo.feed.v1"],
  "permissions_required": ["read_data", "subscribe_data"],
  "build": "npm run build",
  "entry": "dist/index.html"
}
```

If absent, bootstrap refuses and links a template repo. Avoids the "what is this random HTML?" failure mode.

If present, two paths:

- **Manual publish** — bootstrap shows a copyable command: `npx khora publish --room !abc:server`. The user runs it locally; it builds, uploads to media, writes the manifest. Bootstrap polls the room until the manifest appears, then drops them on the new app's detail page. Protocol-purist path.
- **Hosted publish** — only available if a build server is configured (an n8n VM is the obvious candidate). Bootstrap fires a webhook with the repo URL and target room, the build server does the work, the manifest appears in the room, bootstrap takes the user there. UI-only path for non-developers; nothing magic.

Either way, the publish step is a Matrix event in a room the user controls. **Bootstrap is not a build service. It is an orchestrator.**

### 16.6 Library — data

Symmetric to apps. Same browse-or-paste-URI shape. Each card:

```
🌐 Nashville RSS                                eo.feed.v1
Public RSS aggregation, civic and political beats.
↳ 4,213 events • last activity 2h ago
[ Subscribe ]
```

Visibility glyph at left: 🌐 public, 👥 invited, 🔒 vault (E2EE). **Subscribe** is the Matrix join. For invited rooms it's **Request access** → knock event or DM, depending on room config. Once subscribed, the data room is mountable.

Creating data: Library → Data → "+" → schema picker (or "Define new schema" advanced), visibility selector, name. New room created, schema declared as state (§4.1), user at PL 100. From the new room's detail page, **Submit to registry** lists registries the user can publish into.

### 16.7 Mounting

The synthesis moment. From home "+" → **New mount**:

1. **Pick app** — installed apps
2. **Pick data** — subscribed data rooms, **filtered to schema-compatible only**; incompatible rooms appear greyed with "needs `eo.case.v1`; this is `eo.feed.v2`" hover
3. **Configure** — view mode, filters, app-declared prefs from the manifest
4. **Save** → tile appears on home

Schema compatibility is enforced here, at mount time, not at runtime. The iframe never has to handle "oh, this data isn't shaped right."

### 16.8 Fast paths

Long form is for power use. The common case collapses:

- From a data room's detail page → **Open with…** → list of compatible installed apps → tap → mount created and opened, single gesture.
- From an app's detail page → **Mount with…** → list of compatible subscribed data rooms → same.

### 16.9 History

Each mount has a clock icon → three-lane history view:

```
APP RELEASES         DATA SNAPSHOTS       MY PINS
────────────         ──────────────       ───────
v1.4.0  May 6  ●     2026-05-06 15:00     "Investigation review"
v1.3.2  Apr 30                            "Pre-Lighthouse meeting"
v1.3.1  Apr 22       2026-04-15 09:00
                     2026-03-28 12:00
```

Tap any point in any lane → mount reloads at that frame. URL reflects: `?mount=...&app_at=$abc&data_at=$xyz`. Copying the link shares a specific reading. This is **citation as event-ID triple** made tactile.

**Pin** → labeled session snapshot (`eo.user.snapshot`, §5.2), gets a star, sortable to top.

### 16.10 Aesthetic and power-user surface

Default is dense — operator notation visible in activity ribbons (`INS △ → DEF ⊢ stable v1.4.0` when a release lands), mount tiles can optionally show the EO triple of their most recent data event. eo-wiki / wire / NaiBOR aesthetic continuity: terminal-adjacent, monospace numerics, no rounded corners pretending to be friendly.

Settings → **Verbose** toggles deeper surfaces: room IDs everywhere, event IDs on hover, the capability bundle each iframe received, the postMessage audit log scrolling live. For most users, off. For Anchorage-style provenance work and for debugging, on.

### 16.11 Settings drawer

Standard infrastructure surface, deliberately not hidden:

- **Homeservers** — primary, plus mirrors
- **Trusted registries** — toggleable
- **Capability audit log** — every `read`/`append`/`subscribe` call apps have made, filterable per app
- **Delegated publish bots** — the GitHub Actions account, the n8n bot, etc.
- **Pinned versions**
- **Vault keys** — Megolm, exportable, restorable

The audit log is the thing that makes the iframe sandbox claim checkable. If users can see what their apps have actually done, the sandbox is doing real work; if it's hidden, no one can tell whether it is.

### 16.12 The shape — one verb with arguments

**Mounts = doing. Library = finding. History = revisiting.** Within Library, apps and data are mirror images — same browse, subscribe, create, fork moves on both sides. The only place they differ is at mounting, where the asymmetry shows: an app *interprets* (DEF frame), data *is interpreted* (substrate). The UX surfaces that symmetry where it exists and the asymmetry only at the moment it actually matters.

The four actions all share machinery:

| Action | Mechanics |
|---|---|
| Find/add app | Subscribe to an app room |
| Subscribe to data | Subscribe to a data room |
| Fork app | Subscribe + new room with `fork_of` |
| Create from repo | Subscribe + new room + first manifest from build output |

Recognizing them as one verb with arguments is what keeps the UI from sprawling into a CMS. **One add button, four arguments, one consistent shape underneath.**

---

## 17. Standard surfaces and shared component library

**Status:** §17.1 is normative for the reference bootstrap — the listed chrome surfaces are part of the trust boundary and bootstrap MUST expose them. §17.2–§17.4 are recommended conventions, not protocol requirements: alternative bootstraps may diverge from the `@khora/ui` component vocabulary and the standard option keys, but apps that adopt them gain cross-app consistency for free. §17.5 enumerates what is explicitly out of scope.

EO-DB (`clovenbradshaw-ctrl/EO-DB`) is the source of truth for what these surfaces look like in practice. Its component set — universal views, block composition, EO-aware controls, schema management, collaboration — proves out the patterns that every Khora app benefits from. This section lifts those patterns into two layers: **bootstrap-provided surfaces** (free for every app) and the **`@khora/ui` library** (opt-in by import).

The principle: anything that is generic over (a) the EO triple, (b) data-room schemas, or (c) Matrix room mechanics belongs in one of these layers. Anything app-specific stays in the app.

### 17.1 Bootstrap-provided surfaces

Available to every mount without app code. Bootstrap renders these in chrome around the iframe; apps cannot hide or alter them. They are **part of the trust boundary**: a user always knows they can reach them.

| Surface | Purpose | Underlying spec |
|---|---|---|
| Member / power-level viewer | Who's in the data room and at what PL | §4.3 |
| Schema viewer | The active `m.room.data_schema` for the mounted data room | §4.1 |
| Snapshot history (3-lane) | App releases × data snapshots × user pins | §16.9 |
| Capability audit log | Every `read` / `append` / `subscribe` the app has made, filterable. Same surface as the audit log entry in the settings drawer (§16.11); rendered once, reachable from both the mount chrome and settings | §16.11, STORAGE §3.9 |
| Storage usage panel | Per-room IndexedDB footprint, eviction policies | STORAGE §11.2 |
| Mount info | App room ID, manifest hash, data room ID, schema, permissions, source block | §5.1, §3.2, §15.5 |
| Transport status | Active transport per room, peer count, last sync time | §18.5 |
| Verbose toggles | Operator notation, room IDs, event IDs on hover, capability bundle inspector | §16.10 |

Bootstrap chrome is small by default — a single drawer that slides in from the side. Verbose mode expands it.

### 17.2 The `@khora/ui` library

Published as a versioned package in this repo (path TBD: `packages/ui/`). Apps import the components they want; the library is **opt-in**, not bundled with bootstrap. Apps that want a custom UI ignore it entirely.

The library is just code — bootstrap doesn't enforce its use. But apps that adopt it get visual consistency with Khora-CM, eo-wiki, wire, NaiBOR, eoReader, and EO-DB itself. Users develop muscle memory across the suite.

Five families, mapping EO-DB's component inventory:

#### 17.2.1 Universal views

Render any data room in a recognizable mode. View components are generic over schema; they read field metadata from the schema's `event_types` to know what to show.

| Component | Purpose | EO-DB origin |
|---|---|---|
| `<TableView />` | Spreadsheet-like rows over event payloads | `TableView`, `TableBlock` |
| `<KanbanView />` | Column buckets keyed on a schema-declared field | `KanbanView` |
| `<CalendarView />` | Time-axis layout over events with date fields | `CalendarView`, `CalendarBlock` |
| `<GraphView />` | Adjacency rendering over `eo.*.link` events | `GraphView` |
| `<RecordView />` / `<RecordDetailDrawer />` | Per-record full view, flippable to event timeline | `RecordView`, `RecordDetailDrawer`, `RecordTimeline` |
| `<Horizon />` | Multi-layer activity ribbon: operator counts, recent events, sender breakdown | `Horizon`, `HorizonQueryBar` |

Each view accepts `roomId`, `schemaId`, optional `filter` and `at` (event ID for time-traveled rendering, per STORAGE §8). Apps wire one or many.

#### 17.2.2 EO-aware controls

Generic across any EO data room because every event carries `content.eo.{operator, site, resolution}` (§4.2).

| Component | Purpose |
|---|---|
| `<OperatorFilter />` | Chip strip: NUL / DES / INS / SEG / CON / SYN / DEF / EVA / REC. Toggle to include/exclude |
| `<SiteFacet />` | Drill-down by `content.eo.site` |
| `<ResolutionFacet />` | Drill-down by `content.eo.resolution` |
| `<RecTrace />` | Render the chain of events that produced a given object — the REC ↬ as a timeline |
| `<SnapshotDiff />` | Side-by-side `stateAt(A)` vs `stateAt(B)`, structural diff with operator counts |
| `<OperatorRibbon />` | Compact summary suitable for a sidebar; same data as Horizon at lower density |
| `<CitationLink />` | Renders a copyable URL with `?app_at=…&data_at=…` (citation as event-ID triple, §16.9) |

These are the surfaces that make EO-native intuition tactile. EO-DB is built around them; every other app gets them by import.

#### 17.2.3 Schema and data management

| Component | Purpose | EO-DB origin |
|---|---|---|
| `<SchemaView />` | Read-only render of the active `m.room.data_schema` | `SchemaView` |
| `<SchemaEditor />` | PL-gated editor for owners (writes a new schema state event) | `SchemaFieldPanel`, `ColumnManagerPanel`, `ColumnTypeSelector` |
| `<FilterBar />` | Field-aware filter chips | `FilterBar`, `QueryFilterInput` |
| `<SortPanel />` | Multi-key sort by schema fields | `SortPanel` |
| `<FieldPicker />` / `<LinkFieldPicker />` | Reusable selectors driven by schema | `FieldPicker`, `LinkFieldPicker` |
| `<ConstraintComposer />` | Express schema constraints (uniqueness, required, ranges) | `ConstraintComposer` |
| `<ResolutionPolicyComposer />` | Declare how concurrent edits resolve under `SYN ∨` | `ResolutionPolicyComposer` |
| `<ImportView />` | CSV / JSONL import wizard, schema-mapped | `ImportView` |
| `<RecycleBin />` | DES'd events, restorable | `RecycleBin` |

The constraint and resolution-policy composers are EO-specific — they're how operator semantics get expressed at the schema level for use by materializers (STORAGE §7).

#### 17.2.4 Composition blocks

A Notion-style dashboard composer. Apps that want user-configurable layouts import these.

| Component | EO-DB origin |
|---|---|
| `<BlockRegistry />`, `<BlockRenderer />`, `<BlockWrapper />` | Infrastructure |
| `<BlockConfigPanel />` | Per-block configuration drawer |
| `<TableBlock />` `<ListBlock />` `<MetricBlock />` `<RecordBlock />` `<CalendarBlock />` | Data-bound blocks |
| `<HeadingBlock />` `<ParagraphBlock />` | Text |
| `<SectionBlock />` `<ColumnsBlock />` `<DividerBlock />` `<SpacerBlock />` | Layout |
| `<ButtonBlock />` | Action affordance |

Block layouts persist as a state event in the data room under the well-known schema `eo.layout.v1` (event type `eo.layout.dashboard`), so they survive across mounts and are shared with every viewer of that data room. `eo.layout.v1` is listed in `data-schemas/` alongside the other well-known schemas. Large layouts (long block trees, embedded preview thumbnails) externalize via `eo.layout.v1`'s `externalizable_fields[]` declaration per §21.2.

#### 17.2.5 Collaboration surfaces

| Component | Purpose | EO-DB origin |
|---|---|---|
| `<SpaceMembers />` | Roster of an instance space (§14.4) | `SpaceMembers` |
| `<SpaceInvite />` | Generate / accept invites | `SpaceInvite` |
| `<OnlineUsers />` | Live presence | `OnlineUsers`, `PeopleView` |
| `<MessagesView />` / `<WhisperChat />` | In-data-room chat for collaboration | `MessagesView`, `WhisperChat` |
| `<ElementHistory />` | Per-element edit history | `ElementHistory` |

The chat surfaces use Matrix message events in the data room. They are not a separate sub-room — discussion lives next to the data it's about.

### 17.3 Branching surfaces

Branching of data rooms (separate from app-room forking, §3.5) is part of EO-DB's model: `BranchBar`, `BranchExplorer`, `BranchExplorerPanel`. Lifting this requires a protocol decision the spec defers: data branches as separate rooms with `branch_of` linkage, or as a single room with branch tags.

For now: `<BranchBar />` and `<BranchExplorer />` ship in the library against a placeholder protocol. The protocol settles in a follow-up to STORAGE.md once eo-wiki forces the question.

### 17.4 Standard options (user preferences applied across apps)

Beyond components, there is a parallel layer: **per-user, cross-app preferences** that bootstrap stores in the user room (§5) and surfaces to every mount via the capability API.

```typescript
getOption<T>(key: string): T          // per-user, persists in user room
setOption<T>(key: string, value: T)
subscribeOption<T>(key: string, cb): Subscription
```

A small, frozen vocabulary of standard option keys, recognized across all `@khora/ui` components:

| Key | Type | Default | Effect |
|---|---|---|---|
| `ui.density` | `"compact" \| "comfortable"` | `"compact"` | Spacing, font sizes |
| `ui.theme` | `"terminal" \| "paper" \| "system"` | `"terminal"` | Color palette, monospace defaults |
| `ui.operator_badges` | `boolean` | `true` | Show operator glyphs on event listings |
| `ui.verbose` | `boolean` | `false` | Room IDs, event IDs, capability inspector |
| `ui.default_view` | `"table" \| "kanban" \| "calendar" \| "graph" \| "record" \| "horizon"` | `"table"` | Initial view when no app-declared default |
| `ui.timezone` | IANA string | system | Used by all date renderings |
| `ui.locale` | BCP-47 string | system | Used by all formatting |
| `audit.verbosity` | `"off" \| "errors" \| "all"` | `"errors"` | What gets recorded in the capability audit log (§16.11) |
| `snapshot.auto_label` | `boolean` | `true` | Bootstrap suggests labels for user-pinned snapshots |
| `data.confirm_destructive` | `boolean` | `true` | Confirm prompts for DES-flavored actions |

Apps written against `@khora/ui` honor these without per-app code. Custom apps can ignore them, but then they break the cross-app consistency users come to expect — a deliberate cost.

### 17.5 What is *not* standardized

- **Vendor integrations.** Airtable sync, Google Calendar import, OAuth for third-party services, n8n webhooks. These belong in the apps that use them. Lifting them would force every app to drag in dependencies it doesn't need.
- **App-specific business logic.** Case-management vault patterns (Khora-CM), RSS fetch loops (wire), source-identity verification (Anchorage). Each app's reason for existing is the thing that doesn't generalize.
- **GPU acceleration** (`src/gpu/` in EO-DB). App concern; bootstrap stays CPU-side and substrate-thin.
- **Natural-language interfaces** (`src/nl/` in EO-DB). App concern. The library may grow an `<NlQueryBar />` later if multiple apps want one, but it isn't standard.

### 17.6 Versioning

The `@khora/ui` library is independently versioned. Apps pin a major version in their `khora.json` (§16.5):

```json
{
  "ui_library": "@khora/ui@^2.0.0"
}
```

Bootstrap exposes the library as an ESM import the iframe can `import "@khora/ui"` against, served from a known mxc URI alongside the app's bundle. Standard option keys (§17.4) are part of the contract: removing or changing a key is a breaking change requiring a major bump.

### 17.7 Migration path

EO-DB is the source. Phased adoption:

Steps 17a–17d are prerequisites that must complete before the apps in steps 17e–17f can adopt the library. They do not slot neatly into the §10 phases because they cut across them; treat 17a–17d as standing work that runs alongside Phases 1–3.

| Step | Action |
|---|---|
| 17a | Catalog EO-DB's `src/components/` and `src/blocks/` against §17.2's tables; confirm or revise |
| 17b | Extract pure components (no Airtable/GCal coupling) into `packages/ui/` in this repo |
| 17c | Define standard option keys (§17.4) in `schemas/eo.user.preferences.v1.json` |
| 17d | Wire bootstrap chrome surfaces (§17.1) using the same components |
| 17e | Once Phase 2 is complete, port wire to import from `@khora/ui`; once Phase 3 is complete, port eo-wiki similarly |
| 17f | At Phase 7, EO-DB itself migrates to consume `@khora/ui` rather than maintaining a parallel set |

The end state: EO-DB, Khora-CM, eo-wiki, wire, eoReader, NaiBOR, Anchorage all share the same component vocabulary. Every app is recognizably part of the same suite; every user surface that's worth standardizing is standardized exactly once.

---

## 18. Peer-to-peer sync

P2P sync is **available to every app, automatically, with no opt-in and no opt-out**. Bootstrap implements it; the capability API (§6.2) is identical whether events arrive via federation, an embedded homeserver, a WebRTC data channel, mDNS on the LAN, or a USB stick. Apps cannot accidentally ship a homeserver-only app, and cannot test "online" and ship "broken offline."

### 18.1 Why this is bootstrap's job

P2P sync is transport, not protocol. The capability API surface does not change. App authors cannot opt out by choosing not to think about it; bootstrap chooses transports on the app's behalf. That is the guarantee — every app on every device gets P2P for free.

### 18.2 Why this works

Three properties of the substrate make P2P tractable without touching the protocol:

- Matrix events form a content-addressable DAG. Concurrent edits merge under Matrix's existing rules; no new conflict-resolution invented.
- The append-only changelog (STORAGE §3.1, §13.3 refetchability invariant) is a partition-tolerant data structure. Two devices that diverge can merge by union.
- Olm/Megolm E2EE does not depend on the homeserver beyond message relay. Direct exchange between verified devices is supported by the Matrix crypto stack as-is.

STORAGE.md's invariants hold under any transport. Materializers run the same. Time travel works the same. Snapshots restore the same.

### 18.3 Pluggable transports

Bootstrap maintains a transport stack — each transport a small adapter (send event, receive event, list reachable peers). Apps never see the interface.

| Transport | Phase | When useful |
|---|---|---|
| Federation (default) | Phase 1 | Standard Matrix, homeserver-mediated |
| Embedded homeserver | Phase 8 | User hosts their own server in the browser; federates with peers |
| Direct WebRTC | Phase 8 | Two devices on hostile networks, NAT-punched via a signaling room |
| LAN mDNS | Phase 9 | Devices on the same network without internet |
| Sneakernet | Phase 9 | Export the changelog to a file, transfer physically, import |
| Pinecone overlay | Future | Matrix's experimental P2P routing layer |

Bootstrap configures priority order. The active transport for each room is visible in the audit / settings drawer (§16.11, §17.1). Apps see one capability API regardless.

### 18.4 Discovery

Discovery is the question Matrix doesn't fully answer and P2P inherits.

Mechanisms, composable:

- **Homeserver-mediated** — default; the homeserver knows device reachability
- **Signaling room** — a Matrix room dedicated to peer announcements; new devices post reachability info, peers fetch on join
- **Well-known endpoints** — published in `m.room.app` / `m.room.data_schema` for closed networks
- **Local broadcast** — mDNS or BLE on the same LAN
- **Manual** — copy/paste a peer URL or scan a QR code

Discovery for Megolm key sharing piggybacks on the same channels. Cross-signing, SAS, QR verification — the existing Matrix flows — work regardless of how the messages arrive.

### 18.5 What apps may know

The capability API gains one diagnostic, not a behavior switch:

```typescript
getTransport(): Promise<TransportInfo>
getTransportFor(roomId: string): Promise<TransportInfo>

type TransportInfo = {
  kind: "federation" | "embedded" | "direct" | "lan" | "sneakernet" | "offline"
  quality: "synced" | "lagging" | "partial" | "unreachable"
  peers: number
  last_sync_at: number | null
}
```

Apps may surface this for UX — a "working offline, last sync 2h ago" badge, a peer-count chip — but **must not branch their semantics on it.** A `read` is a `read`; what the user sees is whatever the local cache currently knows. STORAGE §10.1 (resync) handles divergent histories; §10.3 (encryption) handles undecryptable events.

A standard `<TransportBadge />` lives in `@khora/ui` (§17.2) so apps that want the indicator get it consistently.

### 18.6 Implications for partition tolerance

P2P amplifies a property STORAGE.md already provides: **the local cache is the source of truth for the session.** Federation lag, partition, or transport changes do not block reads. Writes are queued and replayed when any transport recovers.

A user can:

- Mount an app offline. Iframe loads from cached media (STORAGE §3.6); reads return cached data; writes append locally and sync when reachable.
- Share a session-snapshot URL (§16.9) to a peer with no shared homeserver — the peer imports it and joins the data room directly via WebRTC if they have credentials, or via sneakernet if they don't.
- Run an entire investigation across two devices — one with internet, one without — with periodic USB sync. Common in adversarial environments, impossible in homeserver-only architectures.

These are first-class scenarios, not edge cases. The protocol's claim to "EO-native, Matrix-grounded" is hollow without them.

### 18.7 Constraints

- **NAT traversal.** WebRTC needs it. TURN servers — the only relay form that re-introduces a centralized component — are optional but common. Bootstrap ships a default relay list; users can override or omit.
- **Embedded-homeserver weight.** Conduit-WASM and similar builds are several MB. Loaded lazily, opt-in via settings.
- **Direct transports do not federate** to contacts on remote homeservers. Federation remains the high-level connector; direct paths are the low-level fallback.
- **Sneakernet imports** validate event signatures and refuse forged events. The append-only invariant is preserved. The canonical sneakernet artifact is the external encrypted hydration file (§21.6), consumed by `<ImportView>` and `khora-hyd import` through the same write-contract validator chain.
- **The homeserver-SPOF bullet in §11** is partly resolved by P2P. Mirroring app rooms remains the federation-side mitigation; embedded homeservers and direct exchange are the P2P-side mitigation.

### 18.8 EO frame note

P2P sync changes *who* is on the substrate, not *what* the substrate is. REC ↬ remains the canonical timeline; INS △ remains an event append. The DEF frame for execution (the app room) and the DEF frame for development (the repo, §15) operate identically whether routed via a federated homeserver or a direct peer link. The center of gravity stays in the events, not in any transport.

---

## 19. Easy app building

Four tiers of "easy," each layered on existing primitives. Tiers 0 and 1 are concrete deliverables for the next pass; Tiers 2 and 3 are roadmap. The line we hold throughout: **bootstrap renders blocks, scaffolds emit code, anything beyond that is the app author's job.** Easy app building is not a no-code platform.

### 19.1 Tier 0 — Layout-only apps (no code)

An app whose "code" is a layout. The user composes blocks in the `@khora/ui` block composer (§17.2.4), writes an `eo.layout.dashboard` state event into a data room, and publishes the result as an app. No build, no manifest hash, no JS, no repo.

The mechanics:

1. The user opens the block composer against a data room they have edit rights on.
2. They drag in `<TableBlock>`, `<MetricBlock>`, headings, columns. Each configuration choice is a property of the layout; nothing executes.
3. **Save layout** writes an `eo.layout.dashboard` state event to the data room (well-known schema `eo.layout.v1`, §17.2.4).
4. **Publish as app** creates a new app room with a manifest of a special form:

```json
{
  "type": "m.room.app.manifest",
  "state_key": "v1.0.0",
  "content": {
    "version": "1.0.0",
    "code": {
      "renderer": "khora-layout-renderer",
      "layout_room": "!data-room:server",
      "layout_state_key": ""
    },
    "accepts_schemas": ["eo.layout.v1"],
    "released_at": "...",
    "released_by": "@user:server"
  }
}
```

Bootstrap recognizes the `renderer` field and instantiates a built-in renderer (`khora-layout-renderer`) pointed at the layout event. No `mxc://` fetch, no `sha256` to verify — there is no fetched code. The manifest's trust chain reduces to "does this user know the renderer ID we ship?"

Layout-only apps are forkable, registry-listable, mountable, snapshot-able, and P2P-syncable like any other app. The "code" is just data, which means **a non-developer can produce a real Khora app** — shareable to colleagues, embeddable in instance spaces (§14.4), versioned by the layout's state-event history.

Tier 0 is largely already enabled by §17.2.4. Adding it requires:

- A "Publish dashboard as app" flow in the bootstrap UI (§16, extension to §16.5).
- The `khora-layout-renderer` shipping with bootstrap as a built-in.
- A manifest schema variant accepting `code: { renderer, layout_room, layout_state_key }` instead of `code: { primary_uri, sha256, ... }`. This is an additive change to `m.room.app.manifest` (§3.2).

### 19.2 Tier 1 — Scaffolds via `create-khora-app`

```
npx create-khora-app my-tool
```

Walks the user through:

- **View kind** — `table` / `kanban` / `calendar` / `graph` / `timeline` / `blocks` / `custom`. Each preset wires `<TableView>` / `<KanbanView>` / etc. from `@khora/ui` (§17.2.1).
- **Data schema** — pick an existing well-known schema (`eo.case.v1`, `eo.feed.v1`, `eo.corpus.v1`, `eo.layout.v1`, …) or scaffold a fresh one (`eo.<name>.v1`). The scaffold generator emits a starter `m.room.data_schema` declaration with placeholder event types.
- **Permissions** — pick from the standard set (`read_data`, `append_data`, `subscribe_data`); the wizard refuses to grant more than the schema's `min_pl` allows.
- **Publishing** — GitHub Actions workflow (default), manual via `tools/publish.ts`, or both.

Output: a minimal repo containing

```
my-tool/
├── khora.json              # SPEC §16.5
├── package.json
├── App.tsx                 # imports from @khora/ui
├── index.html
├── .github/workflows/
│   └── publish.yml         # SPEC §15.2
└── README.md
```

Idea → mounted app in under five minutes. The scaffold imports `@khora/ui` and writes via the capability API, so every write inherits the §20 contract automatically.

Deliverables:

- `tools/create-khora-app/` — the CLI itself.
- `templates/<view-kind>/` — one starter repo per view preset.
- A "view kind catalog" in `tools/README.md` mapping kinds to the `@khora/ui` components they wrap.

### 19.3 Tier 2 — `khora dev` (outlook)

Local development loop. Hot-reloads from a localhost source, runs the bootstrap with an embedded homeserver, mounts a sandbox data room seeded with synthetic events matching the chosen schema. No local Matrix install needed; no remote homeserver needed for prototyping. Publishing is `khora publish`. Slated post-Phase 7, alongside the embedded-homeserver work in Phase 8 (§18.3).

### 19.4 Tier 3 — In-bootstrap web IDE (outlook)

Fork an app, edit its source in a Monaco-style editor inside bootstrap, preview live, publish as a fork — without ever leaving the browser. WebContainer or equivalent. Removes the toolchain entirely. Significant build; pays off after the suite is established.

### 19.5 Out of scope

Held firm:

- **Vendor integrations in scaffolds.** Templates emit code that imports `@khora/ui`; they do not bundle Airtable / GCal / OAuth / n8n. Apps that want those add them themselves (§17.5).
- **Server-side workflows from Tier 0 dashboards.** Layout blocks render and read; they do not invoke server logic. A user who wants buttons that run code writes a Tier 1+ app.
- **No-code schema editing in production.** Tier 1's wizard scaffolds a *starter* schema. Evolving a schema in use goes through `m.room.data_schema_migration` (§4.4) deliberately, not through a casual UI.

The line between "easy app building" and "no-code platform" is real. Each tier expands what users can do without writing code; none of them lets users redefine what counts as an event.

---

## 20. The write contract

Every `append()` (§6.2) — whether from a hand-coded app, a Tier 0 dashboard, a Tier 1 scaffold, an `@khora/ui` form, an import tool, or a CLI — produces an event with the same correctness guarantees. This section names them so any write path can be tested against the same checklist.

The contract makes a strong promise: **data added through any room is saved correctly, regardless of which UI added it.** Apps cannot opt out, cannot loosen, cannot shortcut.

### 20.1 Guarantees

For every `append(roomId, eventType, content)`, bootstrap MUST, in order:

1. **Validate the schema.** Fetch the room's active `m.room.data_schema` (cached per STORAGE §3.5). Reject if `eventType` is not declared, or if `content.payload` does not validate against the declared payload schema. No raw event types: every write goes through a declared schema.

2. **Inject or verify the EO triple.** If `content.eo` is absent, derive `operator` from the schema's `event_types[].operator` declaration for `eventType`; default `site` and `resolution` from the schema, allow caller override. If `content.eo` is present, verify `operator` matches the schema's declaration. The triple is mandatory in the persisted event (§4.2).

3. **Check permissions.** The user MUST have at least the schema's declared `min_pl` for `eventType` in the data room AND the mount's declared `permissions` (§6.3) MUST include `append`. Reject before any network or local write.

4. **Local changelog first.** Append to `events` (STORAGE §3.1, §4.1) at the next `local_seq` with a tentative event ID; update `state_current` (if state) and `indexes_live` per the declared materializers (STORAGE §7); resolve the `append` promise immediately. The local cache is the source of truth for the session.

5. **Externalize over-threshold fields.** For each schema-declared `externalizable_field` (§21.2), if the inline serialized size exceeds `threshold_bytes`: optionally compress, compute `sha256` over the bytes that will be uploaded, encrypt per-blob with AES-256-GCM if the room is E2EE (§21.3), upload via authenticated media, and replace the inline value with a reference structure of the same shape as §3.3. Atomic-rollback: if any blob upload fails, the entire `append` is rolled back — the local changelog row is marked `failed`, no event is sent to the homeserver, the upload is queued for retry (`outbound_queue`, STORAGE §3.8), and the calling app sees `MediaUploadFailed` (§20.3). Schemas without `externalizable_fields[]` skip this step; events whose inline payload still exceeds the homeserver event cap after this step fail with `PayloadTooLarge` (§20.3) so schemas missing a needed externalization are surfaced loudly.

6. **Send to Matrix.** PUT the event with a transaction ID derived from the local event ID. On 2xx, replace the tentative event ID with the server-assigned one and rewrite the changelog row in place. On 4xx, mark the local event as `failed` and surface a write-error to the calling app. On network error, retry with exponential backoff (capped, every attempt visible in the capability audit log §17.1).

7. **Encrypt if the room is encrypted.** Plaintext stays in the local `decrypted` store (STORAGE §10.3); only ciphertext flows to peers. Megolm key rotation follows Matrix rules; bootstrap never lets plaintext escape the iframe-host boundary. Externalized blobs are encrypted in step 5 with a per-blob key wrapped into the event payload (§21.3); this step encrypts the event envelope itself.

8. **Read-your-writes.** Any `read` / `readState` / `queryIndex` issued by the same iframe AFTER the `append` promise resolves MUST observe the new event, regardless of whether `/sync` has echoed it back.

9. **Idempotency.** Replays of the same transaction ID are no-ops (Matrix-native). Apps that retry their own writes do not double-append.

10. **Propagation.** Once the homeserver accepts the event, federation and any active P2P transports (§18) fan it out. Other peers' caches receive and apply per the same materializer rules. STORAGE invariants §13.1 (determinism) and §13.3 (refetchability) hold.

11. **Audit.** Every successful write is recorded in the capability audit log (§17.1) with `(room_id, event_id, timestamp, app_room_id, app_manifest_event_id, transaction_id)`. Any data event in any room can be traced to the exact app version that produced it.

### 20.2 The contract spans every entry path

The same eleven guarantees apply whether the write came from:

| Path | How it reaches `append` |
|---|---|
| Hand-coded app | Direct `postMessage` call |
| Tier 0 layout (dashboard composer) | Block composer's own `append` of the layout state event |
| Tier 1 scaffold | Generated form components in `@khora/ui` calling `append` |
| `@khora/ui` `<RecordDetailDrawer>` / `<TableView>` edits | Component-level `append` |
| `<ImportView>` (CSV / JSONL) | Bulk loop of `append` per row |
| `tools/publish.ts` writing manifests / releases | `append` over the same API |
| `importHydration` (external `.khr` file) | Bundle replay through the same validator chain (§21.7) |
| P2P-received write merged in | Inbound transport ingests through the same validator chain |

There is no privileged write path. Bootstrap's own writes (mount events, snapshot events, layout publishing) go through the same contract as app writes.

### 20.3 Failure surfaces

Apps must be ready for `append` to fail. The contract enumerates the fail modes:

| Error | When |
|---|---|
| `SchemaUnknown` | Data room has no `m.room.data_schema` state event |
| `EventTypeNotDeclared` | `eventType` not listed in the schema's `event_types` |
| `PayloadInvalid` | Payload fails JSON-Schema validation |
| `OperatorMismatch` | `content.eo.operator` conflicts with the schema declaration |
| `InsufficientPL` | User's PL is below the schema's `min_pl` for the type |
| `PermissionDenied` | Mount permissions don't include `append` |
| `PayloadTooLarge` | Serialized event still exceeds the homeserver event cap after externalization (or no `externalizable_fields[]` declared on a field that needs them); §21.2 |
| `MediaUploadFailed` | Externalized blob upload failed; event not sent; retry queued in `outbound_queue` (STORAGE §3.8); §21.13 |
| `NetworkUnavailable` (recoverable) | Queued and retried; visible in audit log |
| `Forbidden` (terminal) | Server refused; surfaced to app |
| `Conflict` (rare) | DAG conflict during P2P merge; STORAGE §10.1 path |

Apps that ignore failure surfaces are buggy by definition. Tier 1 scaffolds wire default error UI; Tier 0 layouts surface failures in the composer before publish.

### 20.4 Testing the contract

The contract is testable as a property suite. The Phase 0 fuzz harness (STORAGE §13) extends to write-side properties:

- Generate a random schema; generate random payloads; assert that every payload either validates and is appended, or is rejected before reaching the homeserver.
- Generate concurrent writes from multiple synthetic peers; assert that the merged changelog satisfies determinism (§13.1), refetchability (§13.3), and time-travel exactness (§13.4).
- Replay any room's changelog through `tools/verify.ts`; assert that materialized state matches what the live cache holds.

A write that violates any §20.1 guarantee is a bootstrap bug, not an app bug. The contract is bootstrap's promise — apps trust it the way they trust the iframe sandbox. Every write through every room is saved correctly, or the bootstrap itself is broken and we hear about it.

---

## 21. Event size, externalization, and hydration

Matrix events are capped near 64KB. App-code bundles already handle this via §3.3 (`mxc://` + `sha256` + `parts`). This section generalizes the same pattern to **data events of any kind** — large note bodies, image and PDF attachments, snapshot payloads with substantial state, wiki pages, dashboard layouts — and adds **hydration**: pre-built bundles that let a new device, an offline peer, or an air-gapped recipient bootstrap a room in seconds rather than walking `/sync` from genesis.

Hydration travels on **two complementary paths**: a room-shared path that federates naturally, and an external-file path that works without any homeserver at all. Together they cover disaster recovery (homeserver lost), air-gap device provisioning (USB drop), long-term cold storage (years in a vault), and cross-org handoff (key delivered out-of-band).

Nothing in §21 changes the capability API surface from an app's perspective. Apps still call `read`, `append`, `resolveMedia`. Bootstrap absorbs the size and bootstrap-time problems beneath them.

### 21.1 The 64KB cliff

Hand-coded apps ran into this first via app bundles (§3.3). Once Phase 3 ships writes for arbitrary data, the same cliff returns inside data rooms: `eo.case.evidence` events carrying a scanned PDF, `eo.note` events with multi-megabyte bodies, `eo.layout.dashboard` events as the block composer grows, `eo.import.batch` parents pointing at thousands of children. The pattern that worked for code — reference media by `mxc://` + `sha256`, fall back to HTTPS, split into `parts` if the upload itself exceeds the homeserver media cap — is the right answer for data too. §21 lifts it into the schema layer so apps don't reinvent it per event type.

### 21.2 Externalizable fields

Data schemas (§4.1) gain an additive field on each event-type declaration:

```json
{
  "type": "eo.case.evidence",
  "operator": "INS",
  "min_pl": 50,
  "externalizable_fields": [
    { "field": "payload.attachment", "threshold_bytes": 16384, "compression": null },
    { "field": "payload.body", "threshold_bytes": 32768, "compression": "gzip" }
  ]
}
```

If the inline serialized size of a declared field exceeds its `threshold_bytes`, bootstrap externalizes it before sending to Matrix: optionally compress, hash, encrypt (§21.3 if E2EE), upload via authenticated media, and replace the field's value with a **reference structure** of the same shape as §3.3:

```json
{
  "primary_uri": "mxc://server/AbC...",
  "sha256": "9f86d081...",
  "size_bytes": 234567,
  "content_type": "application/pdf",
  "compression": "gzip" | null,
  "fallback_url": "https://cdn.michael.tld/...",
  "key": { "alg": "A256GCM", "wrapped": "..." }   // E2EE only; see §21.3
}
```

The same field is *either* the inline value *or* the reference — never both, never a parallel `_ref` companion. Apps reading the event call `resolveMedia()` (§6.2) on the reference; the live `read` API hides the distinction. Schema validators recognize the reference shape and accept it interchangeably with the inline schema fragment.

`externalizable_fields[]` is purely additive. Schemas that omit it behave exactly as today: bootstrap rejects oversized writes with `PayloadTooLarge` (added in §21.13). Schemas that adopt it inherit transparent externalization for every write through every entry path (§20.2).

### 21.3 Encryption of externalized blobs

In E2EE rooms, plaintext bytes never leave the device. For each externalized field, bootstrap:

1. Generates a per-blob AES-256-GCM key + 12-byte nonce.
2. Encrypts the blob; computes `sha256` over the **ciphertext** (the field that gets uploaded).
3. Wraps the AES key into the Megolm-encrypted event payload as `reference.key.wrapped`.
4. Uploads ciphertext via authenticated media.

Recipients decrypt the event (Megolm) → unwrap the AES key → fetch the blob via `resolveMedia()` → decrypt with the unwrapped key. The homeserver and any peer without the Megolm session see only ciphertext at rest, plus an opaque media blob that nothing without the key can read. Rotation of Megolm sessions does not invalidate already-uploaded blobs; the wrapped key sits inside the event.

### 21.4 Hydration — shared bundle format

Both hydration paths share one bundle format identifier: `khora.hydration.v1`. A hydration bundle contains, per included room:

- A compact **changelog** segment (events in `local_seq` order, schema-validated by the producer).
- A **state snapshot** at `as_of_event` — equivalent to STORAGE §6.2's checkpoint format.
- Optional **materialized indexes** (rebuildable, but precomputing saves time on import).
- A **schema manifest** listing `schema_id` + `schema_version` per room, so importers can refuse incompatible bundles.
- Optional **Megolm session keys** (gated; §21.6).
- Room metadata: `room_id`, `last_synced_event_id`, producing device, creation timestamp.

The bundle has its own `sha256` and may be Ed25519-signed by the producing device. The internal binary layout — section ordering, length encoding, compression frame format, signature placement — is a Phase 4 companion document; §21 specifies the envelope and semantics, not the byte layout.

### 21.5 Room-shared hydration (`m.room.hydration`)

A new state event type in the data room:

```json
{
  "type": "m.room.hydration",
  "state_key": "v1.0.0",
  "content": {
    "format": "khora.hydration.v1",
    "primary_uri": "mxc://server/HyD...",
    "sha256": "9f86d081...",
    "size_bytes": 12345678,
    "as_of_event": "$evt_at_snapshot",
    "produced_at": "2026-05-06T12:00:00Z",
    "produced_by": "@michael:michael.tld",
    "schema_versions": { "eo.case.v1": "1.0.0" },
    "signature": { "alg": "ed25519", "device_id": "ABC", "value": "..." },
    "expires_at": null
  }
}
```

Encryption follows the room's E2EE configuration: in encrypted rooms the bundle ciphertext is wrapped exactly as in §21.3. New devices joining the room: fetch the latest `m.room.hydration` state → verify `sha256` and signature → decrypt → import to IndexedDB → `/sync` incrementally from `as_of_event`. Federates naturally; works whenever the homeserver is reachable. Multiple `m.room.hydration` events with different `state_key`s coexist; bootstrap uses the most recent one whose schema versions it accepts.

### 21.6 External encrypted hydration files

Standalone, self-contained bundles stored *outside* Matrix entirely — on a USB stick, an S3 bucket, IPFS, the user's NAS, a printed QR code stream. Encrypted with a key the user holds; **the key is never written to any Matrix room.** This path covers what room-shared hydration cannot:

- **Disaster recovery** when the homeserver is gone.
- **Air-gap device provisioning** — file on USB → new device with no network.
- **Long-term cold storage** — vault for years, retrieve much later.
- **Cross-org handoff** with out-of-band key delivery — no shared homeserver needed.

Three key modes:

| Mode | Derivation |
|---|---|
| **Passphrase** (default) | Argon2id KDF (salt + parameters in the file's plaintext header) → 32-byte AES key |
| **Hardware key** | HKDF-SHA256 over the WebAuthn PRF extension output |
| **Split** (optional) | Shamir n-of-m over GF(256); each share is a small `.khr.share` with its own header |

The file uses the `khora.hydration.v1` envelope (§21.4) wrapped as `khora.hydration.v1.khr` with a plaintext header (format, version, key mode, KDF parameters, scope, `key_fingerprint`, `payload_sha256`, claimed counts, schema versions) followed by an AES-GCM nonce, AES-256-GCM ciphertext over the bundle (header bound into the GCM AAD), and an optional Ed25519 signature. The header is plaintext so a recipient who *lacks* the key can still answer "what kind of file is this, who claims to have produced it, and what scope does it cover?" without exposing the payload.

`key_fingerprint` is a public 8-byte SHA-256 prefix of the derived key — non-sensitive, used to match a held key to a stored file before attempting decryption. Wrong key fails fast and explicit at fingerprint-compare; the file never enters the rest of the import pipeline.

Optional **audit breadcrumb**: `eo.user.hydration_index` written to the user's own user room (§5):

```json
{
  "type": "eo.user.hydration_index",
  "content": {
    "taken_at": "2026-05-06T12:34:56Z",
    "label": "before-laptop-trip",
    "file_sha256": "...",
    "key_fingerprint": "...",
    "key_mode": "passphrase",
    "scope": { "room_ids": [...], "as_of_event": {...} },
    "size_bytes": 12345678,
    "storage_hint": "Ledger NAS, /backups/khora/2026-05-06.khr"
  }
}
```

Pure metadata. Never includes the key, the passphrase, the salt, or any payload bytes. The breadcrumb federates through Matrix; the file does not. Together they let a user audit their backup history from any device. The breadcrumb is *not* required for file use — every external file is fully self-describing.

### 21.7 Capability API for hydration

Bootstrap exposes two methods, additive to §6.2:

```typescript
exportHydration(scope, options): Promise<{
  bytes: Uint8Array,
  sha256: string,
  key_fingerprint: string
}>

importHydration(bytes: Uint8Array, key: KeyMaterial): Promise<{
  rooms_imported: RoomId[],
  events_replayed: number,
  conflicts: ConflictRecord[]
}>
```

`scope`: list of room IDs or `"all"`. `options`: `key_mode` (`"passphrase" | "hardware-key" | "split"`), `include_megolm` (default `false` — granting decryption rights for past encrypted events; opt-in per export), `include_indexes`, `include_media_cache` (full vs. references-only), `sign` (Ed25519 with the producing device key), `audit` (write the `eo.user.hydration_index` breadcrumb).

`importHydration` enforces the §20 write contract on every replayed event: each event passes through schema validation, EO-triple verification, and the materializer pipeline. Idempotent — re-importing the same file is a no-op past fingerprint check if a `hydration` row with `source: "external"` already records that `key_fingerprint` (STORAGE §3.7). Rooms whose head is already past the bundle's `as_of_event` treat the import as a historical fast-fill: applies to events not already present, never overwrites existing events. Same-event-id conflicts (homeserver lie or tampering) are surfaced in `ConflictRecord[]`, never silently overwritten.

`exportHydration` and `importHydration` are restricted by mount permissions: a mount without `read` on a room cannot export it; any importer can write into rooms it has membership and `append` rights for. Bootstrap's storage panel and the capability audit log surface every import as `"Imported hydration from external file <key_fingerprint>, scope=…, taken_at=…, signed_by=…"` so exfiltration attempts are visible after the fact.

### 21.8 Bulk imports

Bulk import (`<ImportView>`, CLI tools, sneakernet replays) writes one parent `eo.import.batch` event with children attached via `m.relates_to: { rel_type: "m.thread", event_id: $parent }`. Bootstrap rate-limits child writes (configurable, default 20/sec) so the homeserver isn't flooded; the audit log records the batch as a single line with a child count. Each child still passes through the §20 contract.

### 21.9 Backpressure

`outbound_queue` (STORAGE §3.8) caps pending writes per room. When the cap is hit, `append` resolves with the tentative event ID immediately (per §20 step 4) but the upload waits. The bootstrap UI surfaces pending count and lets the user pause / resume / abandon. Abandoned writes are removed from the queue and marked `failed` in the local changelog; the calling app sees them via the read-your-writes path until eviction.

### 21.10 Orphan-blob GC

External blobs become orphans when the events that referenced them are redacted, when bundles are replaced, or when imports fail mid-flight. Bootstrap **surfaces** orphans in the storage panel with size and age but does **not** auto-delete — incident response and forensic work routinely require recovering a referenced blob long after the event's content has been redacted (Matrix preserves redaction targets per §4.3; the cache should preserve their referenced media on the same principle). Reference counting runs as a periodic background scan over `events`. Users opt into deletion explicitly per blob or in bulk.

### 21.11 Federation, sneakernet, fallback

`mxc://` URIs are server-anchored, which is a real limitation: a recipient on a different homeserver may not be able to fetch the blob even if they can read the event. Mitigations layer:

- **`fallback_url`** in the reference structure — HTTPS gateway, R2, Arweave, IPFS gateway. Bootstrap tries `mxc://` first, falls through to fallback on 404 / federation timeout.
- **Replicated upload** — `tools/publish.ts` (and `tools/hydration.ts`) accept a list of homeservers and post the same blob to each, embedding the highest-availability URI as `primary_uri` and others as `fallback_url`s.
- **P2P direct exchange** (§18.3) — embedded homeserver and direct WebRTC carry blobs the same way as events.
- **External hydration files** (§21.6) — the canonical sneakernet artifact. `<ImportView>` and `khora-hyd import` accept these files and replay them through the same write contract.

### 21.12 Materializer interaction

A field marked `externalizable_fields[]` MUST NOT also appear in the schema's `materializers[]` (STORAGE §7) as a key, value projection, or graph endpoint. Materializers run on the inline event content; an externalized field is a reference, not the underlying value. Apps that need both must duplicate a small projection of the field — for example, a `body_excerpt` short field for materializer keying alongside a full `body` externalizable field. The schema validator enforces the XOR at registration time and rejects schemas that overlap.

### 21.13 The §20 write-contract patch

§20.1 inserts a new step 5 ("Externalize over-threshold fields") between local changelog (step 4) and server send (now step 6); previous steps 5–10 shift to 6–11. §20.3 adds two failure surfaces: `PayloadTooLarge` and `MediaUploadFailed`. The contract continues to apply to every entry path in §20.2 — including `importHydration`, which replays bundle events through the same validator-and-materializer chain.

The full text of the new step and failure surfaces lives in §20.1 and §20.3 respectively; this subsection is a pointer back, not a duplicate.

### 21.14 Phase placement

- **Phase 3** (write path + user rooms) — externalization (§21.2, §21.3, §21.13) lands with the write contract. Schemas adopting `externalizable_fields[]` ship in Phase 3 alongside the apps that need them.
- **Phase 4** (snapshots) — both hydration paths (§21.4–§21.7) land with snapshots. The block composer's `eo.layout.dashboard` events become the first benchmark for externalized state.

Phases 1 and 2 do not depend on §21 features.
