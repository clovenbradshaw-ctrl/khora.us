// External hydration file container (`.khr`), SPEC §21.6.
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Magic           "KHRAHYD1" (8 bytes)                          │
//   │ Version         u16 = 1                                       │
//   │ Flags           u16 (bit 0: signed,                           │
//   │                       bit 1: split-key,                       │
//   │                       bit 2: includes_megolm,                 │
//   │                       bit 3: includes_media_cache)            │
//   │ Header length   u32 (bytes of header JSON that follows)       │
//   │ Header JSON     UTF-8                                         │
//   │ Nonce           12 bytes (AES-GCM IV)                         │
//   │ Ciphertext      AES-256-GCM(payload, key, nonce, AAD=header   │
//   │                              || magic..hdr_len)               │
//   │ Auth tag        16 bytes (GCM tag, embedded by WebCrypto)     │
//   │ Signature       Ed25519 over (magic..ciphertext_with_tag),    │
//   │                 64 bytes; only present if flags bit 0 is set  │
//   └──────────────────────────────────────────────────────────────┘
//
// The header is plaintext so a recipient who lacks the key can still inspect
// what kind of file this is, who claims to have produced it, and what scope
// it covers. The header is bound into the AEAD AAD, so any tampering with it
// invalidates the auth tag.
//
// Currently supported key modes: passphrase (Argon2id → AES-256-GCM).
// Hardware-key (WebAuthn PRF) and split (Shamir n-of-m) are reserved by the
// spec; this implementation rejects them with a clear error so callers know
// to upgrade rather than silently fall back.

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  argon2idDefaults,
  deriveKeyFromPassphrase,
  ed25519Sign,
  ed25519Verify,
  importAesKey,
  keyFingerprint,
  randomBytes,
  sha256,
} from './crypto.js';
import {
  ByteReader,
  ByteWriter,
  bytesEqual,
  concatBytes,
  fromBase64,
  toBase64,
  utf8Decode,
  utf8Encode,
} from './encoding.js';

export const MAGIC = utf8Encode('KHRAHYD1');
export const FILE_VERSION = 1;

export const FLAG_SIGNED = 1 << 0;
export const FLAG_SPLIT_KEY = 1 << 1;
export const FLAG_INCLUDES_MEGOLM = 1 << 2;
export const FLAG_INCLUDES_MEDIA_CACHE = 1 << 3;

/**
 * @typedef {Object} ExportFileOptions
 * @property {Uint8Array} payload          Plaintext bundle bytes (from bundle.encodeBundle).
 * @property {Object} headerExtras         Header fields beyond the ones we compute (scope, created_at, created_by, etc.).
 * @property {Object} key                  { mode: 'passphrase', passphrase: string, params?: Argon2Params }
 *                                         | { mode: 'raw', bytes: Uint8Array }   (for tests / vectors)
 * @property {boolean} [includesMegolm]
 * @property {boolean} [includesMediaCache]
 * @property {{ privateKey: CryptoKey, deviceId: string, publicKey: Uint8Array }} [signingKey]
 * @property {Uint8Array} [overrideNonce]  Test-only: deterministic nonce.
 * @property {Uint8Array} [overrideSalt]   Test-only: deterministic salt.
 *
 * @typedef {Object} ImportFileOptions
 * @property {Uint8Array} bytes
 * @property {Object} key                  Same shape as ExportFileOptions.key, plus optional overrideExpectedFingerprint.
 * @property {Uint8Array} [trustedSignerPubKey]  If set and the file is signed, verify with this Ed25519 raw pubkey.
 */

export async function encodeFile(opts) {
  const {
    payload,
    headerExtras = {},
    key,
    includesMegolm = false,
    includesMediaCache = false,
    signingKey = null,
    overrideNonce = null,
    overrideSalt = null,
  } = opts;

  if (!(payload instanceof Uint8Array)) {
    throw new TypeError('hydration.file: payload must be Uint8Array');
  }

  const { aesKey, header, derivedKey } = await deriveAesKey({ key, headerExtras, overrideSalt });
  const fingerprint = await keyFingerprint(derivedKey);
  header.key_fingerprint = toBase64(fingerprint);
  header.payload_sha256 = toBase64(await sha256(payload));
  if (includesMegolm) header.includes_megolm = true;
  if (includesMediaCache) header.includes_media_cache = true;
  if (signingKey?.publicKey) {
    header.created_by = {
      ...(header.created_by || {}),
      ed25519_pubkey: toBase64(signingKey.publicKey),
      device_id: signingKey.deviceId,
    };
  }

  const nonce = overrideNonce ?? randomBytes(12);
  if (nonce.byteLength !== 12) throw new RangeError('hydration.file: nonce must be 12 bytes');

  const headerBytes = utf8Encode(JSON.stringify(header));

  // Build the prefix (magic..hdr_len..header..nonce). Nonce is folded into the
  // AAD so it is integrity-protected even though AES-GCM also takes it as IV;
  // belt and braces keep the binding explicit.
  let flags = 0;
  if (signingKey) flags |= FLAG_SIGNED;
  if (includesMegolm) flags |= FLAG_INCLUDES_MEGOLM;
  if (includesMediaCache) flags |= FLAG_INCLUDES_MEDIA_CACHE;

  const pre = new ByteWriter();
  pre.writeBytes(MAGIC);
  pre.writeU16LE(FILE_VERSION);
  pre.writeU16LE(flags);
  pre.writeU32LE(headerBytes.byteLength);
  pre.writeBytes(headerBytes);
  pre.writeBytes(nonce);
  const preBytes = pre.toBytes();

  const ciphertext = await aesGcmEncrypt({
    key: aesKey,
    nonce,
    aad: preBytes,
    plaintext: payload,
  });

  const tail = new ByteWriter();
  tail.writeBytes(preBytes);
  tail.writeBytes(ciphertext);

  let signature = null;
  if (signingKey) {
    signature = await ed25519Sign(signingKey.privateKey, tail.toBytes());
    tail.writeBytes(signature);
  }

  const fileBytes = tail.toBytes();
  return {
    bytes: fileBytes,
    sha256: await sha256(fileBytes),
    keyFingerprint: fingerprint,
    header,
  };
}

/**
 * Parse the plaintext header without attempting decryption. Useful for
 * `khora-hyd inspect` and for matching a held key against a stored file
 * before paying KDF cost.
 */
export function inspectFile(bytes) {
  const r = new ByteReader(bytes);
  const magic = r.readBytes(MAGIC.byteLength);
  if (!bytesEqual(magic, MAGIC)) {
    throw new Error('hydration.file: not a khora.hydration.v1 file (magic mismatch)');
  }
  const version = r.readU16LE();
  if (version !== FILE_VERSION) {
    throw new Error(`hydration.file: unsupported version ${version}; expected ${FILE_VERSION}`);
  }
  const flags = r.readU16LE();
  const headerLen = r.readU32LE();
  const headerBytes = r.readBytes(headerLen);
  const header = JSON.parse(utf8Decode(headerBytes));
  return { magic, version, flags, header, headerBytes, headerOffset: r.offset };
}

export async function decodeFile(opts) {
  const { bytes, key, trustedSignerPubKey = null } = opts;

  const r = new ByteReader(bytes);
  const magic = r.readBytes(MAGIC.byteLength);
  if (!bytesEqual(magic, MAGIC)) throw new Error('hydration.file: magic mismatch');

  const version = r.readU16LE();
  if (version !== FILE_VERSION) throw new Error(`hydration.file: unsupported version ${version}`);

  const flags = r.readU16LE();
  const headerLen = r.readU32LE();
  const headerBytes = r.readBytes(headerLen);
  const header = JSON.parse(utf8Decode(headerBytes));
  const nonce = r.readBytes(12);

  const signed = (flags & FLAG_SIGNED) !== 0;
  const sigLen = signed ? 64 : 0;
  const ciphertextLen = bytes.byteLength - r.offset - sigLen;
  if (ciphertextLen < 16) throw new Error('hydration.file: ciphertext too short');
  const ciphertext = r.readBytes(ciphertextLen);

  const aadLen = MAGIC.byteLength + 2 + 2 + 4 + headerLen + 12; // up through nonce
  const preBytes = bytes.subarray(0, aadLen);

  if (signed) {
    const signature = r.readBytes(64);
    if (trustedSignerPubKey) {
      const signedRange = bytes.subarray(0, aadLen + ciphertextLen);
      const ok = await ed25519Verify(trustedSignerPubKey, signature, signedRange);
      if (!ok) throw new Error('hydration.file: Ed25519 signature verification failed');
    }
    // If no trustedSignerPubKey supplied we don't verify here; callers using
    // `khora-hyd verify` should pass one. inspectFile() reports the signed
    // flag for UX.
  }

  const { aesKey, derivedKey } = await deriveAesKey({
    key,
    headerExtras: null,
    overrideSalt: null,
    headerForImport: header,
  });
  const fingerprint = await keyFingerprint(derivedKey);
  const expected = fromBase64(header.key_fingerprint);
  if (!bytesEqual(fingerprint, expected)) {
    throw new Error('hydration.file: wrong key (fingerprint mismatch)');
  }

  const plaintext = await aesGcmDecrypt({
    key: aesKey,
    nonce,
    aad: preBytes,
    ciphertext,
  });

  const expectedPayloadDigest = fromBase64(header.payload_sha256);
  const actualPayloadDigest = await sha256(plaintext);
  if (!bytesEqual(expectedPayloadDigest, actualPayloadDigest)) {
    throw new Error('hydration.file: payload sha256 mismatch after decryption');
  }

  return { header, payload: plaintext, flags };
}

async function deriveAesKey({ key, headerExtras, overrideSalt, headerForImport = null }) {
  if (key.mode === 'raw') {
    if (!(key.bytes instanceof Uint8Array) || key.bytes.byteLength !== 32) {
      throw new Error('hydration.file: raw key must be 32 bytes');
    }
    const aesKey = await importAesKey(key.bytes);
    const header = headerForImport ?? buildHeader({ headerExtras, key });
    return { aesKey, header, derivedKey: key.bytes };
  }
  if (key.mode === 'passphrase') {
    const params = { ...argon2idDefaults(), ...(key.params || {}) };
    const salt = headerForImport
      ? fromBase64(headerForImport.kdf.salt)
      : (overrideSalt ?? randomBytes(16));
    if (salt.byteLength !== 16) throw new RangeError('hydration.file: salt must be 16 bytes');
    const derived = deriveKeyFromPassphrase(key.passphrase, salt, params);
    const aesKey = await importAesKey(derived);
    const header = headerForImport ?? buildHeader({
      headerExtras,
      key,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64(salt),
        iterations: params.iterations,
        memory_kib: params.memoryKiB,
        parallelism: params.parallelism,
      },
    });
    return { aesKey, header, derivedKey: derived };
  }
  if (key.mode === 'hardware-key') {
    throw new Error('hydration.file: hardware-key mode not yet implemented in this build');
  }
  if (key.mode === 'split') {
    throw new Error('hydration.file: split-key mode not yet implemented in this build');
  }
  throw new Error(`hydration.file: unknown key mode ${key.mode}`);
}

function buildHeader({ headerExtras, key, kdf = null }) {
  const base = {
    format: 'khora.hydration',
    version: FILE_VERSION,
    encryption: 'aes-256-gcm',
    key_mode: key.mode,
    ...headerExtras,
  };
  if (kdf) base.kdf = kdf;
  // Required-by-schema fields the caller may fill in via headerExtras:
  // created_at, created_by, scope, schema_versions, claimed_event_count,
  // claimed_room_count. We don't fabricate them.
  return base;
}
