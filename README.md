# Khora

**Khora is a bootstrap, not an app.**

It is the master app users sign in to. From inside Khora they subscribe to datasets, mount apps over them, and share access to specific (app × data) instances the way you'd share a CRM workspace or an Airtable base.

The thing this repo previously called "Khora the app" is now Khora-CM — one app among several (alongside EO///DB, eoReader, eo-wiki, wire, Anchorage) that load through the bootstrap shell over a shared substrate of Matrix rooms.

The full design lives in [SPEC.md](./SPEC.md); local persistence (the changelog, materialized state, checkpoints, time-travel, and the storage substrate behind the capability API) is specified in [STORAGE.md](./STORAGE.md). The short version:

- **Three room kinds.** App rooms hold code + manifest. Data rooms hold content + schema. User rooms hold mounts and snapshots.
- **A session is a triple.** `(app_room, data_room, user_room)`. Bootstrap composes them; the iframe sandbox enforces the boundary.
- **Subscriptions are mounts.** A user subscribes to a dataset under an app. That subscription is a state event in their user room.
- **Instances are shareable.** An (app × data) pair can be wrapped in a Matrix Space and invited into. Joining the space gives you the same instance the inviter has — like being invited to a CRM workspace.
- **Reversibility is automatic.** Every change is a Matrix event. Snapshots at app, data, and session scopes; restore at any of them.
- **Discovery is social.** Registries are rooms. Anyone can run one.
- **Forking is native.** Fork an app room, fork a data room, fork a registry. Audit trail comes free.
- **P2P is automatic.** Bootstrap chooses the transport (federation, embedded homeserver, direct WebRTC, LAN, sneakernet). Apps see one capability API and inherit P2P without any per-app work.
- **Easy app building.** Tier 0 publishes a dashboard composed from blocks as a real app — no code. Tier 1 scaffolds a working app from a wizard in under five minutes (`npx create-khora-app`). Hand-coded apps get the same primitives.
- **One write contract.** Every `append` — from any tier, any tool, any UI, including imports from external hydration files — passes the same eleven guarantees: schema validation, EO-triple injection, permission check, local-first changelog, externalization of over-threshold fields, idempotency, encryption, read-your-writes, P2P propagation, audit. Data added through any room is saved correctly, or bootstrap is broken.
- **Hydration on two paths.** Room-shared `m.room.hydration` bundles federate through Matrix so new devices and offline peers fast-bootstrap any room they can read. External encrypted hydration files (`.khr`) live outside Matrix entirely — disaster recovery, air-gap provisioning, cold storage, cross-org handoff with out-of-band keys. Both paths share one bundle format and replay through the same write contract. (SPEC §21.)

## Repo layout

See SPEC.md §9 for the canonical layout. Today the scaffold contains:

- `bootstrap/` — the shell at the stable origin (planned, Phase 1)
- `apps/` — apps shipped with Khora (each independently publishable)
- `schemas/` — JSON schemas for protocol events
- `data-schemas/` — well-known data schemas
- `tools/` — CLI tools for publish/fork/snapshot/mount/verify

The legacy single-app Khora source still lives at the repo root (`src/`, `index.html`, `package.json`). It will be moved into `apps/khora-cm/` during Phase 6 of the phased implementation; until then it builds and runs as before.

## Phased implementation

The work is sequenced so each phase produces something testable end-to-end.

| Phase | Scope | Window |
|---|---|---|
| 0 | Protocol freeze — JSON schemas, example events | 1 week |
| 1 | Bootstrap MVP — auth, manifest fetch, hash verify, iframe, read+subscribe | 2 weeks |
| 2 | First real app: wire (read-only RSS reader) | 1 week |
| 3 | Write path + user rooms + subscriptions | 2 weeks |
| 4 | Snapshots and time travel | 1 week |
| 5 | Forking, registries, instance spaces | 1 week |
| 6 | Port Khora-CM onto the new bootstrap | 2 weeks |
| 7 | Port EO///DB, eoReader, Anchorage | 3+ weeks |
| 8 | Direct P2P transports (embedded homeserver, WebRTC, signaling) | 3 weeks |
| 9 | LAN and sneakernet transports, full offline-first audit | 2 weeks |

See SPEC.md §10 for the per-phase detail.

## Status

Draft. Phase 0 has not started. The spec is the source of truth; everything else is scaffolding.
