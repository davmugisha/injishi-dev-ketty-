import type { BookingMode } from '@injishi/contracts';
import { randomInt } from 'node:crypto';

/**
 * The four bounds below MOVED to `@injishi/contracts` (ADR-047 wave E) and are
 * re-exported here so every existing caller keeps working.
 *
 * They were server-only, and that was the bug: the calendar cheerfully offered
 * a 120-night stay or a date three years out, and the API refused it at the
 * last click — after the guest had chosen a room, dates, a party and a payment
 * method. A bound the client cannot read is a bound the client cannot help
 * anybody respect. They are DEFINED in one place and restated in none.
 *
 * `PROPERTY_TIME_ZONE` travels with them because it is the same class of fact:
 * "today" and "midnight on check-in day" are Kigali facts, not UTC ones. A
 * same-day booking made at 01:30 in Kigali was once refused as "in the past"
 * because UTC still said yesterday, and the approval window closed two hours
 * after the local day had begun. Rwanda has no daylight saving, so the offset
 * is a constant; the day a second market arrives this becomes a column on
 * `properties`.
 */
export {
  computeBreakdown,
  GUEST_SERVICE_FEE_RATE,
  NON_REFUNDABLE_DISCOUNT,
  MAX_NIGHTS,
  MAX_HORIZON_DAYS,
  DEFAULT_CAPACITY,
  PROPERTY_TIME_ZONE,
} from '@injishi/contracts';

import { PROPERTY_TIME_ZONE as TZ } from '@injishi/contracts';

/** Request-to-book: the host has this long to answer (F-B05 §7). */
export const APPROVAL_WINDOW_HOURS = 24;

const PROPERTY_UTC_OFFSET = '+02:00';

/** yyyy-mm-dd in the property's zone. `en-CA` formats ISO order. */
export function localToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    // `TZ` is the same constant this module re-exports; a `export { … } from`
    // does not bind the name locally, so it is imported once under an alias
    // rather than restated as a literal.
    timeZone: TZ,
  }).format(now);
}

/** 00:00 on `isoDate` in the property's zone, as an instant. */
export function localMidnight(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00${PROPERTY_UTC_OFFSET}`);
}

/**
 * Is this a real calendar date, not merely eight digits in the right places?
 * The wire regex admits `2026-13-45`, which then becomes NaN nights and a
 * misleading refusal (review 4.6).
 */
export function isCalendarDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(isoDate);
}

/**
 * Whole nights between two ISO dates; 0 for a non-positive or unreadable
 * range. The one definition (review 4.1) — the operator desk used to carry its
 * own that answered 1 where this answers 0.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Days from the property's today to `isoDate`; negative for the past. */
export function daysFromToday(isoDate: string, now: Date = new Date()): number {
  return nightsBetween(localToday(now), isoDate) || -nightsBetween(isoDate, localToday(now));
}

export function statusForMode(
  mode: BookingMode,
): 'confirmed' | 'pending_approval' {
  return mode === 'instant_book' ? 'confirmed' : 'pending_approval';
}

export function approvalExpiresAt(
  mode: BookingMode,
  checkIn: string,
  now: Date,
): Date | null {
  if (mode !== 'request_to_book') return null;
  const window = new Date(now.getTime() + APPROVAL_WINDOW_HOURS * 3_600_000);
  const checkInAt = localMidnight(checkIn);
  return checkInAt < window ? checkInAt : window;
}

/**
 * A human-facing reference, e.g. `BK-7Q2M-4XKD`.
 *
 * Eight characters from a 31-letter alphabet with no look-alikes, drawn from
 * the CSPRNG (review 3.5). The six-character `Math.random` version collided
 * inside the booking transaction often enough at volume to matter, and a
 * collision there meant a paid, refunded, failed booking. The repository still
 * retries on the constraint, so a collision now costs one more draw.
 */
export function makeReference(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)];
  return `BK-${out.slice(0, 4)}-${out.slice(4)}`;
}
