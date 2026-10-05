import { createHash, randomBytes } from 'node:crypto';

/**
 * The anonymous conversation token (ADR-061 D-c).
 *
 * 32 random bytes, base64url, carried in an `HttpOnly` cookie. Only its
 * SHA-256 is stored, so the table cannot be read back into a working cookie.
 * It identifies a conversation, never a person: a signed in caller is found by
 * their session and this token is ignored.
 */
export const ANON_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function mintAnonToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashAnonToken(token) };
}

export function hashAnonToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** The hash for a cookie value, or null when it is not a token we minted. */
export function hashFromCookie(value: string | undefined): string | null {
  if (!value || !ANON_TOKEN_PATTERN.test(value)) return null;
  return hashAnonToken(value);
}
