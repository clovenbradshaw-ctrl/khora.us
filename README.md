# Khora

**Khora is a bootstrap, not an app.**

It is the master app users sign in to. From inside Khora they subscribe to datasets, mount apps over them, and share access to specific (app × data) instances the way you'd share a CRM workspace or an Airtable base.

The thing this repo previously called "Khora the app" is now Khora-CM — one app among several (alongside EO///DB, eoReader, eo-wiki, wire, Anchorage) that load through the bootstrap shell over a shared substrate of Matrix rooms.

The full design lives in [SPEC.md](./SPEC.md). The short version:

- **Three room kinds.** App rooms hold code + manifest. Data rooms hold content + schema. User rooms hold mounts and snapshots.
- **A session is a triple.** `(app_room, data_room, user_room)`. Bootstrap composes them; the iframe sandbox enforces the boundary.
- **Subscriptions are mounts.** A user subscribes to a dataset under an app. That subscription is a state event in their user room.
- **Instances are shareable.** An (app × data) pair can be wrapped in a Matrix Space and invited into. Joining the space gives you the same instance the inviter has — like being invited to a CRM workspace.
- **Reversibility is automatic.** Every change is a Matrix event. Snapshots at app, data, and session scopes; restore at any of them.
- **Discovery is social.** Registries are rooms. Anyone can run one.
- **Forking is native.** Fork an app room, fork a data room, fork a registry. Audit trail comes free.

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

See SPEC.md §10 for the per-phase detail.

## Status

Draft. Phase 0 has not started. The spec is the source of truth; everything else is scaffolding.
