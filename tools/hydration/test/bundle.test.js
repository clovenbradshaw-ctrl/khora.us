import { describe, expect, it } from 'vitest';

import { decodeBundle, encodeBundle, SECTION_TYPES } from '../src/bundle.js';
import { utf8Encode } from '../src/encoding.js';

const baseManifest = {
  format: 'khora.hydration.v1',
  version: 1,
  created_at: '2026-05-06T12:34:56Z',
  created_by: { matrix_user_id: '@alice:server', device_id: 'ABC' },
  scope: {
    room_ids: ['!room1:server'],
    as_of_event: { '!room1:server': '$evt-1' },
  },
  schema_versions: { 'eo.case.v1': '1.0.0' },
  claimed_event_count: 2,
  claimed_room_count: 1,
};

function changelogBytes() {
  return utf8Encode(JSON.stringify({
    events: [
      { event_id: '$evt-0', type: 'eo.case.note', body: 'first' },
      { event_id: '$evt-1', type: 'eo.case.note', body: 'second' },
    ],
  }));
}

function stateSnapshotBytes() {
  return utf8Encode(JSON.stringify({ heads: { '$evt-1': true } }));
}

describe('bundle round-trip', () => {
  it('encodes and decodes back to the same manifest + sections', async () => {
    const sections = [
      { type: SECTION_TYPES.CHANGELOG, bytes: changelogBytes() },
      { type: SECTION_TYPES.STATE_SNAPSHOT, bytes: stateSnapshotBytes() },
    ];
    const { bytes } = await encodeBundle({ manifest: baseManifest, sections });
    const decoded = await decodeBundle(bytes);
    expect(decoded.error).toBeNull();
    expect(decoded.manifest).toEqual(baseManifest);
    expect(decoded.sections).toHaveLength(2);
    expect(decoded.sections[0].type).toBe(SECTION_TYPES.CHANGELOG);
    expect(decoded.sections[0].bytes).toEqual(sections[0].bytes);
    expect(decoded.sections[1].bytes).toEqual(sections[1].bytes);
  });

  it('detects a single-byte corruption in section payload', async () => {
    const sections = [
      { type: SECTION_TYPES.CHANGELOG, bytes: changelogBytes() },
      { type: SECTION_TYPES.STATE_SNAPSHOT, bytes: stateSnapshotBytes() },
    ];
    const { bytes } = await encodeBundle({ manifest: baseManifest, sections });

    // Walk the layout to find the first byte of section 0's payload, then
    // flip it. Layout: u32 manifest_len | manifest_bytes | u32 section_count
    // | u8 type | u64 length | 32 bytes sha256 | section bytes ...
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const manifestLen = view.getUint32(0, true);
    const sectionCountOffset = 4 + manifestLen;
    // Section 0 header: 1 (type) + 8 (length) + 32 (sha256) = 41 bytes.
    const section0PayloadOffset = sectionCountOffset + 4 + 1 + 8 + 32;

    const corrupted = new Uint8Array(bytes);
    corrupted[section0PayloadOffset] ^= 0xff;

    const decoded = await decodeBundle(corrupted);
    expect(decoded.error).not.toBeNull();
    expect(decoded.sections.length).toBe(0); // section 0 was the corrupted one
    expect(decoded.manifest).toEqual(baseManifest); // manifest still parses
  });

  it('preserves earlier sections when a later section fails', async () => {
    const sections = [
      { type: SECTION_TYPES.CHANGELOG, bytes: changelogBytes() },
      { type: SECTION_TYPES.STATE_SNAPSHOT, bytes: stateSnapshotBytes() },
      { type: SECTION_TYPES.INDEXES, bytes: utf8Encode('{"idx":1}') },
    ];
    const { bytes } = await encodeBundle({ manifest: baseManifest, sections });

    // Tamper with the LAST byte of the file — it lands in the indexes
    // section payload — and confirm the prior two are still recovered.
    const corrupted = new Uint8Array(bytes);
    corrupted[corrupted.length - 1] ^= 0xff;

    const decoded = await decodeBundle(corrupted);
    expect(decoded.error).not.toBeNull();
    expect(decoded.sections).toHaveLength(2);
    expect(decoded.sections[0].type).toBe(SECTION_TYPES.CHANGELOG);
    expect(decoded.sections[1].type).toBe(SECTION_TYPES.STATE_SNAPSHOT);
  });

  it('rejects an unsupported format identifier', async () => {
    const bogus = { ...baseManifest, format: 'khora.hydration.v999' };
    await expect(encodeBundle({ manifest: bogus, sections: [] }))
      .rejects.toThrow(/unsupported format/);
  });
});
