# Changelog

## Unreleased

### Added
- `SPEC.md` — full specification for Khora as a bootstrap shell + protocol over Matrix rooms.
- `SPEC.md §14` — subscriptions and shared instances. Frames Khora as a master app users sign in to, with subscriptions (mounts) and instances (Matrix Spaces wrapping app+data) as the user-facing primitives. CRM/Airtable mental model crosswalk.
- `SPEC.md §15` — repo and room: development vs execution. The repo is source; the Matrix room is release. Bootstrap never reads from GitHub at runtime. CI is the publish step. Includes the publish pipeline, fork model across both layers, registry-as-seed pattern, and the honest-tension note on CI vendor centralization.
- `SPEC.md §16` — bootstrap UX surface. Three top-level surfaces (Mounts/Library/History), home-as-launcher-of-mounts, mirror-image Library for apps and data, fork modal, create-from-repo flow with `khora.json` repo config, schema-filtered mounting, three-lane history view, citation-as-event-ID-triple URLs, dense default with verbose toggle, settings drawer including the capability audit log. "One verb with arguments" framing.
- `SPEC.md §3.2` — optional `source` block on `m.room.app.manifest` (`repo`, `commit`, `tag`, `build_log`). Makes the repo↔room trust chain auditable end to end without making it required.
- `khora.json` repo config (referenced from §16.5) — minimal manifest declarations bootstrap reads from a source repo to drive create-from-repo. Schema lands in `schemas/` during Phase 0.
- `mxapp://` URI scheme (referenced from §16.3) — convenience scheme bootstrap accepts in the Add-by-URI input alongside room aliases and IDs.
- `STORAGE.md` — sibling spec for local persistence: IndexedDB layout (`events`, `state_current`, `checkpoints`, `indexes_live`, `sync`, `media`, `meta`), append-only changelog rules, schema-declared materializers, time-travel via `stateAt()`, capability-API additions for time-traveled queries and indexes, conflict/resync behavior, storage limits, EO operator alignment, and the invariants the cache must hold (determinism, recoverability, refetchability, time-travel exactness — all fuzz-testable). Treats `events` as REC ↬ made local; everything else is derivation.
- `SPEC.md §17` — standard surfaces and shared component library. Lifts EO-DB's component inventory into two layers: bootstrap-provided surfaces (member viewer, schema viewer, snapshot history, capability audit log, storage panel — every mount gets these for free) and a `@khora/ui` library apps opt into (universal views Table/Kanban/Calendar/Graph/Record/Horizon, EO-aware controls including operator filters and snapshot diff and REC trace, schema/constraint/resolution-policy editors, Notion-style block composition, collaboration surfaces). Adds `getOption`/`setOption` for cross-app user preferences with a frozen vocabulary (density, theme, operator badges, verbose, default view, audit verbosity). Migration path lifts EO-DB itself into the library so it consumes what it inspired.
- `SPEC.md §18` — peer-to-peer sync as a bootstrap responsibility. Every app gets P2P automatically; the capability API is transport-transparent. Pluggable transport stack (federation, embedded homeserver, WebRTC, mDNS, sneakernet, Pinecone), discovery via signaling rooms / well-known endpoints / local broadcast / manual exchange, single diagnostic method (`getTransport` / `getTransportFor`) for UX, partition-tolerance scenarios as first-class, plus Phase 8 (direct P2P) and Phase 9 (LAN + sneakernet) added to the phase plan.
- `SPEC.md §19` — easy app building, four tiers. Tier 0: layout-only apps (compose blocks, publish dashboard as an app, no code). Tier 1: `npx create-khora-app` scaffolds (view kind / schema / permissions wizard, emits a working repo against `@khora/ui` with publish workflow). Tier 2: `khora dev` with hot reload + embedded homeserver. Tier 3: in-bootstrap web IDE. Tiers 0 and 1 are concrete deliverables; 2 and 3 are roadmap. Held line: bootstrap renders blocks, scaffolds emit code, anything beyond is the app author's job.
- `SPEC.md §3.2.1` — additive layout-renderer manifest variant: `code: { renderer, layout_room, layout_state_key }` for Tier 0 apps. No fetched code, no `sha256` to verify; trust chain reduces to recognizing built-in renderer IDs.
- `SPEC.md §20` — the write contract. Ten ordered guarantees on every `append` regardless of entry path (hand-coded apps, Tier 0 dashboards, Tier 1 scaffolds, `<ImportView>`, CLI tools, P2P-merged inbound writes). Schema validation, EO-triple injection, permission check, local-first changelog, server confirmation with idempotency, encryption, read-your-writes, P2P propagation, audit log capture. Failure surfaces enumerated; testable via the Phase 0 fuzz harness extending the STORAGE.md invariants. Forward-references added to §4.2 and §6.2.
- `tools/README.md` adds `create-khora-app/` and a view-kind catalog mapping wizard choices to `@khora/ui` components; `verify.ts` row updated to mention the §20 fuzz harness role.
- Repo layout in §9 adds a `templates/` directory for `create-khora-app` starter repos.
- README highlights now include easy app building (Tier 0 + Tier 1) and the write contract.
- `SPEC.md §6.2` rewritten as the canonical, complete capability API listing. All methods from §14, STORAGE §9, §17.4, and §18.5 now appear in one block (with `SnapshotMetadata` type defined inline). Notes transport-transparency and points readers to STORAGE.md and §17.4 for backing detail.

### Fixed
- §3.2 manifest example now includes the optional `source` block introduced in §15.5.
- §5.2 snapshot-scope table no longer implies `eo.case.snapshot` is the canonical data-snapshot type; data snapshots are schema-specific (declared in `m.room.data_schema`).
- §9 repo layout adds the missing `m.room.data_schema_migration.json`, `m.room.registry.entry.json`, `m.room.instance.json`, `eo.user.preferences.v1.json`, `khora.json`, and `tools/publish-from-ci.ts`. A note clarifies the layout shows the final state.
- §10 Phase 0 scope expanded to lock §14.4, §15.5, §16.5, and §17.4 schemas alongside the original §3/§4/§5/§6.2 set, reflecting actual spec growth.
- §16.3 Library card example reflects only `eo.case.v1` (the example previously implied a `v2` that doesn't exist).
- §17 gains a status preamble distinguishing normative chrome (§17.1) from recommended convention (§17.2–§17.4).
- §17.1 Mount-info row points at the right sections (§5.1, §3.2, §15.5) and adds a Transport-status row reflecting §18.
- §17.2.4 promotes the dashboard schema from "TBD" to a concrete well-known data schema (`eo.layout.v1`, event type `eo.layout.dashboard`).
- §17.7 phasing language disambiguated: 17a–17d are prerequisites; 17e ports happen after Phases 2/3 complete.
- STORAGE §3.7 / §7 clarify that schema metadata is per-room (in `sync`), not duplicated in `meta`.
- STORAGE §7.4 walks back the unsupported "negligible" claim about materializer cost; defers to the Phase 0 fuzz harness.
- STORAGE §9 reconciles `snapshot` / `restore` / `listSnapshots` signatures with §6.2; adds `SnapshotMetadata` type and clarifies `scope` semantics including `"all"`.
- STORAGE §12 makes explicit that checkpoints are local-only and do not exist as Matrix events; the operator table is local-storage actions, not protocol-level mappings (which remain in SPEC §8).
- `schemas/README.md` adds rows for `m.room.data_schema_migration.json`, `eo.user.preferences.v1.json`, and `khora.json`; versioning section now distinguishes manifest-version, schema-id, and event-type-name strategies.
- `data-schemas/README.md` adds `eo.layout.v1.json`.
- `README.md` mentions STORAGE.md as a sibling spec, adds P2P to the short-version list, extends the phase table to include 8 and 9.
- Directory scaffold from SPEC §9: `bootstrap/`, `apps/{khora-cm,eodb,eoreader,eo-wiki,wire,anchorage}/`, `schemas/`, `data-schemas/`, `tools/`, each with a placeholder README explaining its scope.
- `tools/README.md` adds `publish-from-ci.ts` (CI-side publish) and notes the `verify.ts` source-walk role.
- `apps/README.md` adds the per-app `.github/workflows/publish.yml` convention.
- `CHANGELOG.md` (this file).

### Changed
- `README.md` rewritten. The repo is now a bootstrap, not an app. The legacy single-app README has been replaced; that document's content is preserved in git history.

### Deprecated
- The single-app architecture at the repo root. Existing source under `src/`, `index.html`, `package.json`, `vite.config.js` continues to build and run unchanged but will be moved into `apps/khora-cm/` during Phase 6 of the phased implementation.

### Notes
- This is a draft for repo overwrite. No protocol code has shipped. Phase 0 (protocol freeze + JSON schemas) is the next concrete step.
