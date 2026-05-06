# `tools/hydration/` — `@khora/hydration`

Reference implementation of the `khora.hydration.v1` bundle format and the
external `.khr` file container specified in [SPEC §21](../../SPEC.md#21-event-size-externalization-and-hydration).

This is the JS library that backs:

- The `exportHydration` / `importHydration` capability methods (SPEC §6.2,
  Phase 4 — wired through the bootstrap shell when that lands).
- The `khora-hyd` CLI for producing / consuming external hydration files
  outside the bootstrap (disaster recovery, air-gap provisioning, cold
  storage, cross-org handoff).

## Surface

```js
import {
  exportHydration,
  importHydration,
  inspect,
  verify,
} from '@khora/hydration';
```

- `exportHydration({ rooms, created_by, key, ... })` — build a `.khr` from
  the caller-supplied per-room sections; encrypt with the chosen key mode;
  optionally Ed25519-sign with the producing device's key.
- `importHydration({ bytes, key })` — decrypt, verify hashes, return the
  decoded bundle manifest and sections. Idempotent on `key_fingerprint` —
  callers persist that into `STORAGE.hydration` (SPEC §3.7) to dedupe
  re-imports.
- `inspect(bytes)` — parse the plaintext header without paying KDF cost or
  attempting decryption. Used for the "what file is this?" surface.
- `verify(bytes, { trustedSignerPubKey })` — structural + signature check
  without decryption. Lets a recipient sanity-check a file in cold storage
  before ever surfacing the key.

Lower-level building blocks (`encodeBundle`, `decodeBundle`, `encodeFile`,
`decodeFile`) are also exported for tests and custom workflows.

## Key modes

| Mode | Status | Notes |
|---|---|---|
| `passphrase` | implemented | Argon2id (`@noble/hashes`) with the spec defaults: t=3, m=64 MiB, p=4. Salt is 16 random bytes per file, recorded in the plaintext header. |
| `raw` | implemented (test-only) | Pass a 32-byte AES key directly. Used by known-answer test vectors so the suite doesn't pay Argon2id cost on every CI run. |
| `hardware-key` | reserved | WebAuthn PRF extension. Lands when bootstrap gains its WebAuthn surface. |
| `split` | reserved | Shamir n-of-m over GF(256). Lands when there's a real custody scenario driving it. |

Reserved modes throw a clear error (`hardware-key mode not yet implemented in
this build`) so callers know to upgrade rather than silently fall back.

## CLI

```
khora-hyd export   --in bundle.json --out backup.khr --passphrase-stdin
khora-hyd import   --in backup.khr  --out decoded.json --passphrase-stdin
khora-hyd inspect  backup.khr
khora-hyd verify   --in backup.khr  --with <ed25519-pubkey-base64>
```

`bundle.json` describes the rooms and section payloads to bundle; see
`src/cli.js` for the schema. The `inspect` and `verify` subcommands are
key-free, so anyone holding the file can sanity-check it without ever
surfacing the encryption key.

## File format

See [SPEC §21.6](../../SPEC.md#216-external-encrypted-hydration-files) for
the canonical description. In short: 8-byte magic `KHRAHYD1`, u16 version,
u16 flags, u32 header length, UTF-8 JSON header, 12-byte AES-GCM nonce,
ciphertext (with embedded GCM tag), optional 64-byte Ed25519 signature.

The header is plaintext but bound into the AEAD AAD, so any tampering with
it invalidates the auth tag. A recipient who lacks the key can still
identify what the file is from the header alone — the whole point of the
external-file path.

## Tests

```
npm test -- tools/hydration
```

The suite covers:

- Bundle round-trip (encode → decode produces the input).
- Per-section sha256 detection (corrupt one byte → import fails at the
  affected section, prior sections are kept).
- Passphrase-mode `.khr` round-trip with a fixed salt + fixed nonce so the
  output is deterministic.
- Wrong-passphrase fails fast at fingerprint compare without ever attempting
  AES-GCM decryption.
- Header tampering (a single byte flip in the plaintext header) breaks the
  AEAD auth tag and surfaces an error.
- Ed25519 signing + verification against a known-good keypair.

## Status

Phase 4 deliverable per SPEC §10. The library and CLI are functional today;
the bootstrap-side wiring (capability API, storage panel surface, audit-log
integration) lands when the bootstrap shell does.
