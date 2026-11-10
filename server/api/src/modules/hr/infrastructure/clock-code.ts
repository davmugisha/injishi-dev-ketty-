import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The code an entrance tablet shows for phones to scan (058-time, clock-in
 * rules). It names the tablet and a 30 second window, signed with a key kept on
 * the server, so it cannot be made up, and it runs out: a scan is good for the
 * window it was shown in and the two before, 90 seconds at most. A photo of it
 * sent to someone at home is stale before it is any use.
 */
export const CODE_WINDOW_MS = 30_000;
/** How many windows a code is good for, the one it was shown in included. */
export const CODE_WINDOWS_GOOD = 3;

const KIOSK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The signing key, derived from the PIN pepper so there is no second secret to set. */
export function clockCodeKey(pepper: string): Buffer {
  return createHmac('sha256', pepper).update('injishi clock-in code v1').digest();
}

function signature(key: Buffer, kioskId: string, window: number): string {
  return createHmac('sha256', key).update(`${kioskId}.${window}`).digest('base64url').slice(0, 22);
}

export function windowOf(at: number): number {
  return Math.floor(at / CODE_WINDOW_MS);
}

/** "<kiosk id>.<window>.<signature>". */
export function signClockCode(key: Buffer, kioskId: string, window: number): string {
  return `${kioskId}.${window.toString(36)}.${signature(key, kioskId, window)}`;
}

/**
 * The tablet a code names, when it is genuine. `expired` when it is genuine
 * but too old (or from a clock far ahead); `wrong` when it is not a code at all.
 */
export function readClockCode(key: Buffer, code: string, now: number): { kioskId: string } | 'expired' | 'wrong' {
  const parts = code.trim().split('.');
  if (parts.length !== 3) return 'wrong';
  const [kioskId, w36, sig] = parts;
  if (!KIOSK_ID.test(kioskId) || !/^[0-9a-z]{1,12}$/.test(w36)) return 'wrong';
  const window = parseInt(w36, 36);
  const expected = Buffer.from(signature(key, kioskId, window));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'wrong';
  const current = windowOf(now);
  // One window of slack ahead, for a tablet whose clock runs a little fast.
  if (window > current + 1 || window <= current - CODE_WINDOWS_GOOD) return 'expired';
  return { kioskId };
}
