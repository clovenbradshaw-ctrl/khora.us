// Crypto primitives for hydration files. Browsers and Node 22+ both expose
// the same WebCrypto surface, so we use it directly. Argon2id is provided by
// @noble/hashes — pure JS, runs in both environments.

import { argon2id } from '@noble/hashes/argon2.js';

import { concatBytes, utf8Encode } from './encoding.js';

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  throw new Error('hydration: globalThis.crypto.subtle is required (Node 19+ or modern browser)');
}

export async function sha256(bytes) {
  const buf = await subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

export function randomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

const ARGON2_DEFAULTS = Object.freeze({
  iterations: 3,
  memoryKiB: 65536,
  parallelism: 4,
  outputLength: 32,
});

export function argon2idDefaults() {
  return { ...ARGON2_DEFAULTS };
}

// Derive a 32-byte key from a passphrase using Argon2id with the given
// parameters. Synchronous; for very large memory_kib this can take a moment,
// but for the spec defaults (64 MiB, 3 iterations, 4 lanes) it completes in
// well under a second on commodity hardware.
export function deriveKeyFromPassphrase(passphrase, salt, params = ARGON2_DEFAULTS) {
  const merged = { ...ARGON2_DEFAULTS, ...params };
  return argon2id(utf8Encode(passphrase), salt, {
    t: merged.iterations,
    m: merged.memoryKiB,
    p: merged.parallelism,
    dkLen: merged.outputLength,
  });
}

// Compute a non-sensitive 8-byte fingerprint of a derived key. Used to
// match a held key to a stored file before attempting decryption — wrong
// keys fail at fingerprint compare without exposing payload bytes.
export async function keyFingerprint(key32) {
  const digest = await sha256(key32);
  return digest.subarray(0, 8);
}

export async function importAesKey(key32) {
  return subtle.importKey('raw', key32, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// AES-256-GCM with the header in the AAD slot, so any tampering with the
// plaintext header invalidates the auth tag. Returns ciphertext including
// the 16-byte auth tag at the tail (WebCrypto's convention).
export async function aesGcmEncrypt({ key, nonce, aad, plaintext }) {
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, plaintext);
  return new Uint8Array(ct);
}

export async function aesGcmDecrypt({ key, nonce, aad, ciphertext }) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, ciphertext);
  return new Uint8Array(pt);
}

// Ed25519 sign / verify via WebCrypto (Node 22+ supports this).
export async function ed25519GenerateKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  return { keyPair: pair, publicKey: pub };
}

export async function ed25519Sign(privateKey, bytes) {
  const sig = await subtle.sign({ name: 'Ed25519' }, privateKey, bytes);
  return new Uint8Array(sig);
}

export async function ed25519Verify(publicKeyRaw, signature, bytes) {
  const key = await subtle.importKey('raw', publicKeyRaw, { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, signature, bytes);
}

export { concatBytes, utf8Encode };
