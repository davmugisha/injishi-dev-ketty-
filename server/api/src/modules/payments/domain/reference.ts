import { createHash } from 'node:crypto';

/**
 * The reference Injishi sends a payment provider for one instruction
 * (073-gtbank-payments AC-6).
 *
 * Derived from the idempotency key, never random: a process that dies after
 * sending and before recording the answer must, on any retry or pull, address
 * the SAME transaction at the provider. A random reference minted per attempt
 * would turn that crash into a second charge.
 *
 * `INJ` plus the first 20 characters of the key's SHA-256 in RFC 4648 base32
 * (letters and the digits 2 to 7), 23 characters in all. Short and plain
 * enough for any provider's reference field; GTBank's exact format is owed
 * (Owed by GTBank: reference format), and when it arrives this one function
 * changes, still deterministic.
 */
export function referenceFor(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey, 'utf8').digest();
  return `INJ${base32(digest).slice(0, 20)}`;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes: Buffer): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
