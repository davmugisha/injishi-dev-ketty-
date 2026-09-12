import { randomBytes } from 'node:crypto';

import { TokenCipher, TokenCipherError, decodeTokenKey } from './token-cipher';

describe('TokenCipher', () => {
  const key = randomBytes(32);
  const cipher = new TokenCipher(key);
  const CONTEXT = 'ebm:access:org-1';

  it('round-trips a token', () => {
    const sealed = cipher.encrypt('eyJhbGciOi.secret.token', CONTEXT);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('secret');
    expect(cipher.decrypt(sealed, CONTEXT)).toBe('eyJhbGciOi.secret.token');
  });

  it('never produces the same ciphertext twice for the same token', () => {
    // A fixed IV would let anyone reading the table see which businesses share
    // a token, and would break GCM's security outright.
    expect(cipher.encrypt('same', CONTEXT)).not.toBe(
      cipher.encrypt('same', CONTEXT),
    );
  });

  it('refuses a tampered ciphertext', () => {
    const sealed = cipher.encrypt('token', CONTEXT);
    const [v, iv, tag, body] = sealed.split('.');
    const flipped = Buffer.from(body, 'base64url');
    flipped[0] ^= 0x01;
    const tampered = [v, iv, tag, flipped.toString('base64url')].join('.');
    expect(() => cipher.decrypt(tampered, CONTEXT)).toThrow(TokenCipherError);
  });

  it('refuses a token moved onto another record', () => {
    const sealed = cipher.encrypt('token', 'ebm:access:org-1');
    expect(() => cipher.decrypt(sealed, 'ebm:access:org-2')).toThrow(
      TokenCipherError,
    );
  });

  it('refuses a token sealed under a different key', () => {
    const sealed = new TokenCipher(randomBytes(32)).encrypt('token', CONTEXT);
    expect(() => cipher.decrypt(sealed, CONTEXT)).toThrow(TokenCipherError);
  });

  it('does not leak the ciphertext or plaintext in its error', () => {
    const sealed = cipher.encrypt('super-secret-value', CONTEXT);
    try {
      cipher.decrypt(sealed, 'wrong');
      throw new Error('expected a refusal');
    } catch (error) {
      expect(String(error)).not.toContain('super-secret-value');
      expect(String(error)).not.toContain(sealed.split('.')[3]);
    }
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => decodeTokenKey(randomBytes(16).toString('base64'))).toThrow(
      /exactly 32 bytes/,
    );
    expect(() => decodeTokenKey('correct horse battery staple')).toThrow(
      TokenCipherError,
    );
    expect(() => decodeTokenKey(undefined)).toThrow(/required/);
    expect(() => new TokenCipher(randomBytes(31))).toThrow(TokenCipherError);
  });

  it('accepts a base64url key as well as base64', () => {
    const raw = randomBytes(32);
    expect(decodeTokenKey(raw.toString('base64url')).equals(raw)).toBe(true);
    expect(decodeTokenKey(raw.toString('base64')).equals(raw)).toBe(true);
  });
});
