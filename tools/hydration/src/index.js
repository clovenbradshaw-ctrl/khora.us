// Public API for the hydration library.
//
// Two surfaces:
//   - low-level:  encodeBundle / decodeBundle / encodeFile / decodeFile
//   - high-level: exportHydration / importHydration / inspect / verify
//
// The high-level surface is what `tools/hydration.ts` (`khora-hyd`) and
// bootstrap's capability API will wrap. The low-level surface stays
// available for tests, custom workflows, and integration with the §20
// write-contract path that will land in Phase 3.

import { decodeBundle, encodeBundle, SECTION_NAMES, SECTION_TYPES } from './bundle.js';
import { decodeFile, encodeFile, FLAG_INCLUDES_MEDIA_CACHE, FLAG_INCLUDES_MEGOLM, FLAG_SIGNED, inspectFile } from './file.js';
import { sha256 } from './crypto.js';
import { toBase64 } from './encoding.js';

export { decodeBundle, decodeFile, encodeBundle, encodeFile, inspectFile, SECTION_TYPES, SECTION_NAMES };

/**
 * High-level: build a complete .khr file from a set of room bundles.
 *
 * @param {Object} args
 * @param {Array<{ room_id: string, as_of_event: string, sections: import('./bundle.js').BundleSection[] }>} args.rooms
 * @param {{ matrix_user_id: string, device_id?: string }} args.created_by
 * @param {Object<string,string>} [args.schema_versions]
 * @param {boolean} [args.includes_megolm]
 * @param {boolean} [args.includes_media_cache]
 * @param {Object} args.key                  See encodeFile docs.
 * @param {{ privateKey: CryptoKey, deviceId: string, publicKey: Uint8Array }} [args.signing_key]
 */
export async function exportHydration(args) {
  const {
    rooms,
    created_by,
    schema_versions = {},
    includes_megolm = false,
    includes_media_cache = false,
    key,
    signing_key = null,
    label = null,
    overrideNonce = null,
    overrideSalt = null,
  } = args;

  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new Error('exportHydration: rooms must be a non-empty array');
  }

  const room_ids = [];
  const as_of_event = {};
  let claimedEventCount = 0;
  const sections = [];

  for (const room of rooms) {
    if (!room.room_id) throw new Error('exportHydration: room.room_id required');
    if (!room.as_of_event) throw new Error('exportHydration: room.as_of_event required');
    room_ids.push(room.room_id);
    as_of_event[room.room_id] = room.as_of_event;
    for (const section of room.sections || []) {
      sections.push(section);
    }
    if (typeof room.event_count === 'number') claimedEventCount += room.event_count;
  }

  const manifest = {
    format: 'khora.hydration.v1',
    version: 1,
    created_at: new Date().toISOString(),
    created_by,
    scope: { room_ids, as_of_event },
    schema_versions,
    claimed_event_count: claimedEventCount,
    claimed_room_count: room_ids.length,
  };

  const { bytes: bundleBytes } = await encodeBundle({ manifest, sections });

  const { bytes: fileBytes, sha256: fileSha256, keyFingerprint, header } = await encodeFile({
    payload: bundleBytes,
    headerExtras: {
      created_at: manifest.created_at,
      created_by,
      scope: manifest.scope,
      schema_versions,
      claimed_event_count: claimedEventCount,
      claimed_room_count: room_ids.length,
      label,
    },
    key,
    includesMegolm: includes_megolm,
    includesMediaCache: includes_media_cache,
    signingKey: signing_key,
    overrideNonce,
    overrideSalt,
  });

  return {
    bytes: fileBytes,
    sha256: toBase64(fileSha256),
    key_fingerprint: toBase64(keyFingerprint),
    header,
  };
}

/**
 * High-level: parse and verify a .khr file, returning the decoded bundle
 * manifest, sections, and the decrypted payload sha256.
 *
 * @param {{ bytes: Uint8Array, key: object, trustedSignerPubKey?: Uint8Array }} args
 */
export async function importHydration(args) {
  const { header, payload } = await decodeFile(args);
  const { manifest, sections, error } = await decodeBundle(payload);
  if (error) throw error;
  return {
    file_header: header,
    manifest,
    sections,
    payload_sha256: toBase64(await sha256(payload)),
  };
}

/**
 * Cheap header inspection — no key, no decryption, no signature check. Used
 * by `khora-hyd inspect` and by the storage panel surface to identify a file
 * before paying KDF cost.
 */
export function inspect(bytes) {
  const { version, flags, header, headerOffset } = inspectFile(bytes);
  return {
    version,
    signed: (flags & FLAG_SIGNED) !== 0,
    includes_megolm: (flags & FLAG_INCLUDES_MEGOLM) !== 0,
    includes_media_cache: (flags & FLAG_INCLUDES_MEDIA_CACHE) !== 0,
    header,
    header_offset: headerOffset,
  };
}

/**
 * Structural + signature verify without decrypting. Returns true if the file
 * parses, the magic / version match, and (if signed) the supplied trusted
 * pubkey verifies the signature. Does *not* validate the payload — that
 * requires the key.
 */
export async function verify(bytes, { trustedSignerPubKey = null } = {}) {
  const info = inspect(bytes);
  if (!info.signed) return { ok: true, signed: false, header: info.header };
  if (!trustedSignerPubKey) {
    return { ok: false, signed: true, reason: 'signed file but no trustedSignerPubKey supplied', header: info.header };
  }
  // Re-decode just enough to extract the signature and the signed range.
  // Reuse decodeFile with a bogus key would force a KDF run; cheaper to
  // re-parse manually here.
  const { ed25519Verify } = await import('./crypto.js');
  const sigOffset = bytes.byteLength - 64;
  const signature = bytes.subarray(sigOffset);
  const signedRange = bytes.subarray(0, sigOffset);
  const ok = await ed25519Verify(trustedSignerPubKey, signature, signedRange);
  return { ok, signed: true, header: info.header };
}
