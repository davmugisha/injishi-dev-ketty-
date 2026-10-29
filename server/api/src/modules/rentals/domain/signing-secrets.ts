import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * The two secrets signing hands out (WP 1.5b), and the only form either is
 * kept in: its SHA-256.
 *
 * - A signing code: 6 random digits, emailed to the signer, good for 10
 *   minutes and 5 tries (`lease_signing_codes.code_hash`).
 * - An invitation token: 32 random bytes, base64url, in the link mailed to the
 *   tenant (`lease_invitations.token_hash`). The link is the only place the
 *   token ever exists in the clear.
 */

/** A fresh 6 digit code, leading zeros kept. */
export function newSigningCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Does `code` hash to `hash`? Compared in constant time. */
export function codeMatches(code: string, hash: string): boolean {
  const left = Buffer.from(sha256Hex(code), 'hex');
  const right = Buffer.from(hash, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** A fresh invitation token and the hash that is stored for it. */
export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256Hex(token) };
}
