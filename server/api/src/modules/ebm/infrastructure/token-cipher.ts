import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for the credentials that can declare tax in a business's
 * name (ADR-041).
 *
 * An EBM access token is the power to certify invoices under a taxpayer's TIN,
 * and a refresh token is that power renewable for as long as the provider
 * allows. Neither may sit in the database as text: a dump, a backup, a replica
 * or a support engineer's `SELECT` would each hand it out. So they are stored as
 * AES-256-GCM ciphertext under a key that lives in the process environment and
 * never in the database it protects.
 *
 * GCM rather than CBC because it AUTHENTICATES: a ciphertext that was altered —
 * or one lifted from another row — fails to decrypt instead of decrypting to
 * garbage that is then sent as a bearer token.
 *
 * The `context` argument is bound in as additional authenticated data. It names
 * what the value is and whose it is (`ebm:access:<orgId>`), so a person with
 * write access to the table cannot move one business's token onto another
 * business's row and have it decrypt: the tag covers the context, and the
 * context no longer matches.
 */

/** Bumped if the format ever changes, so old rows stay readable and say so. */
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
/** 96 bits, the IV length GCM is specified for; anything else is re-hashed. */
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class TokenCipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCipherError';
  }
}

/**
 * Decode `EBM_TOKEN_ENCRYPTION_KEY`.
 *
 * Accepts base64 or base64url, and nothing that is not exactly 32 bytes once
 * decoded. A shorter key is not "slightly weaker"; for AES-256 it is a
 * configuration mistake, and the most common one is pasting a password where a
 * key belongs. Refusing it at boot is cheaper than discovering it in an audit.
 */
export function decodeTokenKey(raw: string | undefined): Buffer {
  const text = raw?.trim() ?? '';
  if (!text) {
    throw new TokenCipherError(
      'EBM_TOKEN_ENCRYPTION_KEY is required. Generate one with `openssl rand -base64 32`.',
    );
  }
  const key = Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new TokenCipherError(
      `EBM_TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes; it decodes to ${key.length}. ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }
  return key;
}

export class TokenCipher {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new TokenCipherError(
        `a token key must be ${KEY_BYTES} bytes, got ${key.length}`,
      );
    }
    // Copied, so a caller that later zeroes or reuses its buffer cannot change
    // the key under a running process.
    this.key = Buffer.from(key);
  }

  static fromEnv(raw: string | undefined): TokenCipher {
    return new TokenCipher(decodeTokenKey(raw));
  }

  /** `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
  encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const body = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      body.toString('base64url'),
    ].join('.');
  }

  /**
   * The plaintext, or `TokenCipherError`.
   *
   * The error never carries the ciphertext or any part of the plaintext. It is
   * logged by callers, and a log line is exactly where a token must not end up.
   */
  decrypt(sealed: string, context: string): string {
    const parts = sealed.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new TokenCipherError('stored token is not in the v1 sealed format');
    }
    const [, ivText, tagText, bodyText] = parts;
    const iv = Buffer.from(ivText, 'base64url');
    const tag = Buffer.from(tagText, 'base64url');
    const body = Buffer.from(bodyText, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new TokenCipherError('stored token has a malformed iv or tag');
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString(
        'utf8',
      );
    } catch {
      // One message for every cause — a wrong key, a tampered body, a token
      // moved from another row. Distinguishing them would tell a person probing
      // the table which of their edits came closest.
      throw new TokenCipherError(
        'stored token failed authentication (wrong key, altered, or moved from another record)',
      );
    }
  }
}
