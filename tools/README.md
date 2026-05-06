# tools/

CLI tools for operating on the Khora protocol. Each tool reads/writes Matrix events directly — they're convenience wrappers, not protocol-level requirements.

| Tool | Purpose | SPEC reference |
|---|---|---|
| `publish.ts` | Upload an app build to homeserver media, write a `m.room.app.manifest` event, optionally tag a `m.room.app.release` | §3.2, §3.4 |
| `publish-from-ci.ts` | The same publish flow, called from CI with secrets. Populates the manifest `source` block from the build environment (repo URL, commit, tag, build log) | §15.2, §15.5 |
| `fork.ts` | Create a fork app room with `fork_of` set to the source manifest event | §3.5 |
| `snapshot.ts` | Tag a snapshot at app, data, or session scope | §5.2 |
| `mount.ts` | Subscribe a user to an (app, data) pair by writing `eo.user.mount` to their user room | §5.1, §14.2 |
| `verify.ts` | Verify a running iframe app's loaded code matches its manifest's `sha256`. Also walks the optional `source` block: manifest → repo at commit → CI build log. Used by the §20 fuzz harness to assert determinism over a room's changelog | §3.2, §15.5, §20.4 |
| `hydration.ts` (`khora-hyd`) | CLI wrapper over the `exportHydration` / `importHydration` capability API: produce and consume external `.khr` hydration files for disaster recovery, air-gap provisioning, cold storage, and cross-org handoff. Subcommands: `export`, `import`, `inspect` (header-only, no key needed), `verify` (signature + structure, no decryption). Supports passphrase / hardware-key (WebAuthn PRF) / Shamir n-of-m split key modes | §21.6, §21.7 |
| `create-khora-app/` | `npx create-khora-app <name>` — Tier 1 scaffold generator. Walks a wizard (view kind / schema / permissions / publish path), emits a starter repo against `@khora/ui` with `khora.json`, `App.tsx`, and `.github/workflows/publish.yml` | §19.2 |

## Status

Empty. These tools will be written alongside the phases that need them — `publish.ts`, `publish-from-ci.ts`, and `verify.ts` are Phase 1 prerequisites; `mount.ts` arrives in Phase 3; `snapshot.ts` and `hydration.ts` in Phase 4 (both depend on the snapshot / hydration work); `fork.ts` in Phase 5; `create-khora-app/` lands once `@khora/ui` extraction (§17.7 step 17b) is far enough along to scaffold against.

## View kind catalog (`create-khora-app`)

The Tier 1 wizard maps view kinds to `@khora/ui` (§17.2.1) components:

| View kind | Wraps | Suits |
|---|---|---|
| `table` | `<TableView>` | Spreadsheet-style data |
| `kanban` | `<KanbanView>` | Status-bucketed records |
| `calendar` | `<CalendarView>` | Time-axis layouts |
| `graph` | `<GraphView>` | Linked / relational data |
| `timeline` | `<Horizon>` | Activity ribbons, event streams |
| `blocks` | `<BlockRenderer>` + a starter block layout | Configurable dashboards |
| `custom` | bare scaffold | Apps that bring their own UI |

## Repo↔room handoff

The repo is the development surface; the Matrix room is the runtime surface. These tools sit at the handoff between them. `publish-from-ci.ts` in particular is the single place GitHub Actions touches the protocol — bootstrap and apps never call back into GitHub at runtime. See SPEC §15 for the full reasoning.
