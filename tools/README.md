# tools/

CLI tools for operating on the Khora protocol. Each tool reads/writes Matrix events directly — they're convenience wrappers, not protocol-level requirements.

| Tool | Purpose | SPEC reference |
|---|---|---|
| `publish.ts` | Upload an app build to homeserver media, write a `m.room.app.manifest` event, optionally tag a `m.room.app.release` | §3.2, §3.4 |
| `publish-from-ci.ts` | The same publish flow, called from CI with secrets. Populates the manifest `source` block from the build environment (repo URL, commit, tag, build log) | §15.2, §15.5 |
| `fork.ts` | Create a fork app room with `fork_of` set to the source manifest event | §3.5 |
| `snapshot.ts` | Tag a snapshot at app, data, or session scope | §5.2 |
| `mount.ts` | Subscribe a user to an (app, data) pair by writing `eo.user.mount` to their user room | §5.1, §14.2 |
| `verify.ts` | Verify a running iframe app's loaded code matches its manifest's `sha256`. Also walks the optional `source` block: manifest → repo at commit → CI build log | §3.2, §15.5 |

## Status

Empty. These tools will be written alongside the phases that need them — `publish.ts`, `publish-from-ci.ts`, and `verify.ts` are Phase 1 prerequisites; `mount.ts` arrives in Phase 3; `snapshot.ts` in Phase 4; `fork.ts` in Phase 5.

## Repo↔room handoff

The repo is the development surface; the Matrix room is the runtime surface. These tools sit at the handoff between them. `publish-from-ci.ts` in particular is the single place GitHub Actions touches the protocol — bootstrap and apps never call back into GitHub at runtime. See SPEC §15 for the full reasoning.
