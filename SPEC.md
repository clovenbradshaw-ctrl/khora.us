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
| Data | `eo.case.snapshot` (in data room) | A point in the data timeline |
| Session | `eo.user.snapshot` (in user room) | Mounts, prefs, scroll position, app+data event IDs at the moment |

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

```typescript
// Calls the app makes via postMessage to bootstrap:
read(roomId: string, eventType: string, filter?: object): Promise<Event[]>
readState(roomId: string, eventType: string, stateKey: string): Promise<StateEvent>
append(roomId: string, eventType: string, content: object): Promise<EventId>
subscribe(roomId: string, eventType: string, callback: (e: Event) => void): Subscription
resolveMedia(mxcUri: string): Promise<Blob>
snapshot(label: string): Promise<EventId>
restore(snapshotEventId: string): Promise<void>
```

Bootstrap rejects calls outside the app's mount scope. App cannot read tokens, cannot reach unmounted rooms, cannot widen permissions. App can be killed by closing the iframe.

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
│   ├── m.room.registry.json
│   ├── eo.user.mount.json
│   └── eo.user.snapshot.json
│
├── data-schemas/              # well-known data schemas
│   ├── eo.case.v1.json
│   ├── eo.corpus.v1.json
│   ├── eo.feed.v1.json
│   └── eo.eodb.v1.json
│
└── tools/                     # CLI tools
    ├── publish.ts             # upload app code, write manifest, tag release
    ├── fork.ts                # create fork app room
    ├── snapshot.ts            # tag snapshot at any scope
    ├── mount.ts               # add a mount to a user room
    └── verify.ts              # verify a running app against its manifest
```

---

## 10. Phased implementation

**Phase 0 — Protocol freeze (1 week)**
Lock §3, §4, §5, §6.2 schemas. Write JSON schemas in `schemas/`. Regression tests against example events. No code yet.

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

---

## 11. Constraints, gaps, known unknowns

- **Matrix tokens are unscoped.** Bootstrap's iframe sandbox is doing real load-bearing work. A bug there is a credential leak. Audit this surface harder than anything else. Consider a read-only proxy in front for high-stakes deployments.
- **State event 64KB cap** means manifests can't inline anything substantial. All app code goes through media. Verified.
- **Authenticated media (MSC3916)** changed the game in late 2024. Bootstrap must use `/_matrix/client/v1/media/download/...` with `Authorization` header, not the deprecated unauthenticated endpoints. mxc:// resolution is a privileged operation that only bootstrap performs; apps receive `Blob` URLs.
- **Federation lag.** A manifest event in a remote room may not have propagated when bootstrap tries to read it. Retry with backoff; surface the wait.
- **Schema versioning** is the place this design will hurt first. Treat breaking changes as new rooms. Do not try to be clever about in-place schema migration in v1.
- **Homeserver SPOF.** Mirror critical app rooms to a second homeserver. The protocol supports this naturally (federation); we just have to actually do it.
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
