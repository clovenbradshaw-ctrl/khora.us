# tools/

CLI tools for operating on the Khora protocol. Each tool reads/writes Matrix events directly — they're convenience wrappers, not protocol-level requirements.

| Tool | Purpose | SPEC reference |
|---|---|---|
| `publish.ts` | Upload an app build to homeserver media, write a `m.room.app.manifest` event, optionally tag a `m.room.app.release` | §3.2, §3.4 |
| `fork.ts` | Create a fork app room with `fork_of` set to the source manifest event | §3.5 |
| `snapshot.ts` | Tag a snapshot at app, data, or session scope | §5.2 |
| `mount.ts` | Subscribe a user to an (app, data) pair by writing `eo.user.mount` to their user room | §5.1, §14.2 |
| `verify.ts` | Verify a running iframe app's loaded code matches its manifest's `sha256` | §3.2 |

## Status

Empty. These tools will be written alongside the phases that need them — `publish.ts` and `verify.ts` are Phase 1 prerequisites; `mount.ts` arrives in Phase 3; `snapshot.ts` in Phase 4; `fork.ts` in Phase 5.
