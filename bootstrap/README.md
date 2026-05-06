# bootstrap/

The Khora bootstrap shell. Lives at a stable origin (e.g. `app.michael.tld`).

This is the master app users sign in to. It is the single source of executable trust in the system: it holds the Matrix access token, fetches app manifests, verifies hashes, creates sandboxed iframes, and brokers every cross-frame call through the capability API.

## Status

Empty. Phase 1 of SPEC §10 fills this in:

- `index.html`
- `src/auth.ts` — Matrix login, token refresh, OIDC when ready
- `src/loader.ts` — manifest fetch, hash verification, iframe creation
- `src/capability.ts` — postMessage capability API (SPEC §6.2)
- `src/sandbox.ts` — iframe lifecycle, `sandbox="allow-scripts"` enforcement
- `src/snapshot.ts` — DEF events at app/data/session scope (SPEC §5.2, Phase 4)
- `src/registry.ts` — discovery UI (SPEC §7, Phase 5)
- `src/mount.ts` — (app × data) pairing, subscription resolution (SPEC §5, §14)
- `src/ui/` — the three top-level surfaces (Mounts / Library / History) per SPEC §16, plus the fork and create-from-repo modals (§16.4–§16.5), the schema-filtered mount picker (§16.7), and the verbose settings drawer (§16.10–§16.11)
- `tests/` — unit + integration tests; in particular the iframe sandbox boundary

## Constraints worth re-reading before writing code

From SPEC §11:

- Matrix tokens are unscoped. The iframe sandbox is doing real load-bearing work. A bug here is a credential leak.
- Authenticated media (MSC3916): use `/_matrix/client/v1/media/download/...` with `Authorization` header. Apps receive `Blob` URLs, never raw `mxc://` resolution.
- State events have a 64KB cap. Manifests inline nothing substantial; all app code goes through media.
- Federation lag is real. Retry with backoff; surface the wait.
