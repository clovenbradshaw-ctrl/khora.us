import { describe, expect, it } from 'vitest';

import { exportHydration, importHydration, inspect, verify } from '../src/index.js';
import { ed25519GenerateKey, randomBytes } from '../src/crypto.js';
import { utf8Encode } from '../src/encoding.js';
import { SECTION_TYPES } from '../src/bundle.js';

const ROOMS = [
  {
    room_id: '!case:server',
    as_of_event: '$evt-100',
    event_count: 3,
    sections: [
      { type: SECTION_TYPES.CHANGELOG, bytes: utf8Encode('{"events":[1,2,3]}') },
      { type: SECTION_TYPES.STATE_SNAPSHOT, bytes: utf8Encode('{"head":"$evt-100"}') },
    ],
  },
];

describe('high-level export/import', () => {
  it('round-trips a small bundle through .khr with raw key', async () => {
    const rawKey = randomBytes(32);
    const result = await exportHydration({
      rooms: ROOMS,
      created_by: { matrix_user_id: '@alice:server', device_id: 'D1' },
      schema_versions: { 'eo.case.v1': '1.0.0' },
      key: { mode: 'raw', bytes: rawKey },
    });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.key_fingerprint).toMatch(/^[A-Za-z0-9+/=]+$/);

    const imported = await importHydration({
      bytes: result.bytes,
      key: { mode: 'raw', bytes: rawKey },
    });
    expect(imported.manifest.scope.room_ids).toEqual(['!case:server']);
    expect(imported.manifest.claimed_event_count).toBe(3);
    expect(imported.sections).toHaveLength(2);
    expect(imported.file_header.label).toBeNull();
  });

  it('inspect() returns header without decryption', async () => {
    const rawKey = randomBytes(32);
    const result = await exportHydration({
      rooms: ROOMS,
      created_by: { matrix_user_id: '@alice:server' },
      key: { mode: 'raw', bytes: rawKey },
      label: 'before-laptop-trip',
    });
    const info = inspect(result.bytes);
    expect(info.signed).toBe(false);
    expect(info.header.label).toBe('before-laptop-trip');
    expect(info.header.scope.room_ids).toEqual(['!case:server']);
  });

  it('verify() returns ok for a signed file with the right pubkey', async () => {
    const rawKey = randomBytes(32);
    const { keyPair, publicKey } = await ed25519GenerateKey();
    const result = await exportHydration({
      rooms: ROOMS,
      created_by: { matrix_user_id: '@alice:server' },
      key: { mode: 'raw', bytes: rawKey },
      signing_key: { privateKey: keyPair.privateKey, deviceId: 'D1', publicKey },
    });
    const v = await verify(result.bytes, { trustedSignerPubKey: publicKey });
    expect(v.ok).toBe(true);
    expect(v.signed).toBe(true);
  });

  it('verify() returns ok=false when no pubkey supplied for a signed file', async () => {
    const rawKey = randomBytes(32);
    const { keyPair, publicKey } = await ed25519GenerateKey();
    const result = await exportHydration({
      rooms: ROOMS,
      created_by: { matrix_user_id: '@alice:server' },
      key: { mode: 'raw', bytes: rawKey },
      signing_key: { privateKey: keyPair.privateKey, deviceId: 'D1', publicKey },
    });
    const v = await verify(result.bytes);
    expect(v.ok).toBe(false);
    expect(v.signed).toBe(true);
  });
});
