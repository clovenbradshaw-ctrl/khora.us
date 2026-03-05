/**
 * FieldCrypto — AES-256-GCM field-level encryption.
 *
 * Direct port from existing Khora with claim object extensions.
 * Uses Web Crypto API — works in any modern browser, no dependencies.
 */

export const FieldCrypto = {
  /**
   * Generate a new AES-256-GCM key, returned as base64.
   */
  async generateKey() {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  },

  /**
   * Encrypt plaintext string with a base64 AES-256-GCM key.
   * Returns { ciphertext: base64, iv: base64 }.
   */
  async encrypt(plaintext, keyB64) {
    const keyBuf = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBuf, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(enc))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  },

  /**
   * Decrypt ciphertext with iv and key (all base64).
   * Returns plaintext string or null on failure.
   */
  async decrypt(cipherB64, ivB64, keyB64) {
    try {
      const keyBuf = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', keyBuf, 'AES-GCM', false, ['decrypt']);
      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const ct = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(dec);
    } catch {
      return null;
    }
  },

  /**
   * Encrypt a full claim object. JSON-stringifies the claim, then encrypts.
   * Returns { encrypted: { ciphertext, iv } }.
   */
  async encryptClaim(claim, keyB64) {
    const plaintext = JSON.stringify(claim);
    const { ciphertext, iv } = await this.encrypt(plaintext, keyB64);
    return { encrypted: { ciphertext, iv } };
  },

  /**
   * Decrypt an encrypted claim object. Returns the claim object or null.
   */
  async decryptClaim(encClaim, keyB64) {
    try {
      const { ciphertext, iv } = encClaim.encrypted || encClaim;
      const plaintext = await this.decrypt(ciphertext, iv, keyB64);
      if (!plaintext) return null;
      return JSON.parse(plaintext);
    } catch {
      return null;
    }
  },
};
