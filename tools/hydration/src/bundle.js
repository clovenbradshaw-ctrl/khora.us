// khora.hydration.v1 bundle format (SPEC §21.4).
//
// Plaintext binary container that holds, per included room, a manifest plus
// an ordered list of typed sections. The bundle is the unit consumed by both
// hydration paths:
//
//   - room-shared:  bundle is uploaded as authenticated media; an
//                   m.room.hydration state event references it (SPEC §21.5).
//   - external file: bundle becomes the plaintext payload of a .khr container
//                   (SPEC §21.6). See file.js.
//
// Layout (all integers little-endian):
//
//   manifest_len       u32
//   manifest_bytes     UTF-8 JSON
//   section_count      u32
//   for each section:
//     section_type     u8     (1=changelog, 2=state-snapshot, 3=indexes,
//                              4=megolm-keys, 5=media-cache, 6=schema-bundle)
//     section_length   u64
//     section_sha256   32 bytes  (over the bytes that follow)
//     section_bytes    (caller-defined; typically zstd or gzip compressed)
//
// Per-section sha256 lets a partially-corrupt bundle still recover the
// sections that hash. Importers walk sequentially and abort at the first
// hash mismatch, keeping prior sections.

import { ByteReader, ByteWriter, bytesEqual, utf8Decode, utf8Encode } from './encoding.js';
import { sha256 } from './crypto.js';

export const SECTION_TYPES = Object.freeze({
  CHANGELOG: 1,
  STATE_SNAPSHOT: 2,
  INDEXES: 3,
  MEGOLM_KEYS: 4,
  MEDIA_CACHE: 5,
  SCHEMA_BUNDLE: 6,
});

export const SECTION_NAMES = Object.freeze({
  1: 'changelog',
  2: 'state-snapshot',
  3: 'indexes',
  4: 'megolm-keys',
  5: 'media-cache',
  6: 'schema-bundle',
});

/**
 * @typedef {Object} BundleManifest
 * @property {string} format        Always "khora.hydration.v1".
 * @property {number} version       Always 1.
 * @property {string} created_at    ISO 8601.
 * @property {Object} created_by    { matrix_user_id, device_id?, ed25519_pubkey? (base64) }
 * @property {Object} scope         { room_ids: string[], as_of_event: { [room_id]: event_id } }
 * @property {Object} schema_versions  { [schema_id]: version }
 * @property {number} claimed_event_count
 * @property {number} claimed_room_count
 *
 * @typedef {Object} BundleSection
 * @property {number} type      One of SECTION_TYPES.
 * @property {Uint8Array} bytes Section payload (already compressed if applicable).
 */

/**
 * Encode a bundle. Returns the bundle bytes plus per-section sha256 digests
 * (handy for callers that want to record them in a manifest event).
 *
 * @param {{ manifest: BundleManifest, sections: BundleSection[] }} args
 * @returns {Promise<{ bytes: Uint8Array, sectionDigests: Uint8Array[] }>}
 */
export async function encodeBundle({ manifest, sections }) {
  validateManifest(manifest);

  const w = new ByteWriter();
  const manifestBytes = utf8Encode(JSON.stringify(manifest));
  w.writeU32LE(manifestBytes.byteLength);
  w.writeBytes(manifestBytes);
  w.writeU32LE(sections.length);

  const sectionDigests = [];
  for (const section of sections) {
    if (!Number.isInteger(section.type) || section.type < 1 || section.type > 255) {
      throw new RangeError(`hydration.bundle: invalid section type ${section.type}`);
    }
    if (!(section.bytes instanceof Uint8Array)) {
      throw new TypeError('hydration.bundle: section.bytes must be Uint8Array');
    }
    const digest = await sha256(section.bytes);
    sectionDigests.push(digest);
    w.writeU8(section.type);
    w.writeU64LE(section.bytes.byteLength);
    w.writeBytes(digest);
    w.writeBytes(section.bytes);
  }

  return { bytes: w.toBytes(), sectionDigests };
}

/**
 * Decode a bundle. Verifies each section's sha256 before yielding the
 * section bytes; on hash mismatch returns the sections decoded so far plus
 * an error so callers can salvage partial state.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<{ manifest: BundleManifest, sections: BundleSection[], error: Error | null }>}
 */
export async function decodeBundle(bytes) {
  const r = new ByteReader(bytes);
  const manifestLen = r.readU32LE();
  const manifestBytes = r.readBytes(manifestLen);
  const manifest = JSON.parse(utf8Decode(manifestBytes));
  validateManifest(manifest);

  const sectionCount = r.readU32LE();
  const sections = [];
  for (let i = 0; i < sectionCount; i++) {
    const type = r.readU8();
    const length = r.readU64LE();
    const expectedDigest = r.readBytes(32);
    const payload = r.readBytes(length);
    const actualDigest = await sha256(payload);
    if (!bytesEqual(expectedDigest, actualDigest)) {
      return {
        manifest,
        sections,
        error: new Error(`hydration.bundle: section ${i} (${SECTION_NAMES[type] || type}) sha256 mismatch`),
      };
    }
    sections.push({ type, bytes: payload });
  }
  return { manifest, sections, error: null };
}

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new TypeError('hydration.bundle: manifest must be an object');
  if (m.format !== 'khora.hydration.v1') {
    throw new Error(`hydration.bundle: unsupported format "${m.format}"`);
  }
  if (m.version !== 1) {
    throw new Error(`hydration.bundle: unsupported version ${m.version}`);
  }
  if (!m.scope || !Array.isArray(m.scope.room_ids) || m.scope.room_ids.length === 0) {
    throw new Error('hydration.bundle: manifest.scope.room_ids must be a non-empty array');
  }
}
