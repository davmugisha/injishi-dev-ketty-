import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Kiosk PINs and tokens (ADR-058, 058-time AC-TM10, AC-TM11). A PIN, a pairing
 * code and a device token exist only as hashes.
 *
 * A PIN is HMACed with the server's pepper and then scrypted with a salt of
 * its own, stored as `scrypt$N$r$p$salt$hash`. The pepper is what makes a
 * leaked table alone useless: there are only a million 6 digit PINs, so a salt
 * by itself slows nobody down. A pairing code and a device token are random
 * and long enough that a plain SHA-256 is the right hash for them.
 */

/** DI token for the pepper, resolved once at boot (`resolvePinPepper`). */
export const HR_PIN_PEPPER = Symbol('HR_PIN_PEPPER');

const N = 16384;
const R = 8;
const P = 1;
const KEY_BYTES = 32;

function scryptAsync(password: Buffer, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function peppered(pin: string, pepper: string): Buffer {
  return createHmac('sha256', pepper).update(pin, 'utf8').digest();
}

export async function hashPin(pin: string, pepper: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(peppered(pin, pepper), salt, KEY_BYTES, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Constant time; false for anything that is not a hash this file wrote. */
export async function verifyPin(pin: string, stored: string, pepper: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  if (![options.N, options.r, options.p].every((v) => Number.isInteger(v) && v > 0) || expected.length === 0) return false;
  const key = await scryptAsync(peppered(pin, pepper), Buffer.from(salt, 'base64'), expected.length, options);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** The one time pairing code a kiosk is shown as: 8 digits, leading zeros kept. */
export function newPairingCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

/** The device token the kiosk's cookie carries: 32 random bytes. */
export function newDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}
