// Low-level encoding helpers for the khora.hydration.v1 bundle and the .khr
// file container. All multi-byte integers little-endian per SPEC §21.6.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function utf8Encode(s) {
  return textEncoder.encode(s);
}

export function utf8Decode(bytes) {
  return textDecoder.decode(bytes);
}

export function concatBytes(...parts) {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export function bytesEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export function fromBase64(s) {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

export function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

export class ByteWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }
  writeBytes(b) {
    this.chunks.push(b);
    this.length += b.byteLength;
  }
  writeU8(n) {
    const b = new Uint8Array([n & 0xff]);
    this.writeBytes(b);
  }
  writeU16LE(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    this.writeBytes(b);
  }
  writeU32LE(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    this.writeBytes(b);
  }
  writeU64LE(n) {
    const b = new Uint8Array(8);
    const big = typeof n === 'bigint' ? n : BigInt(n);
    new DataView(b.buffer).setBigUint64(0, big, true);
    this.writeBytes(b);
  }
  toBytes() {
    return concatBytes(...this.chunks);
  }
}

export class ByteReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  remaining() {
    return this.bytes.byteLength - this.offset;
  }
  readBytes(n) {
    if (this.remaining() < n) throw new RangeError('hydration: short read');
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
  readU8() {
    return this.readBytes(1)[0];
  }
  readU16LE() {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  readU32LE() {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  readU64LE() {
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return Number(v); // safe for sizes that fit in IEEE-754
  }
}
