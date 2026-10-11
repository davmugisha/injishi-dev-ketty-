/**
 * The clock the roster and attendance run on (HR module, Phase 5).
 *
 * Every working day here is a KIGALI day, wherever the server sits. Rwanda
 * keeps UTC+2 all year, so a wall clock time on a day is one fixed instant and
 * the conversions below need no time zone database: they are arithmetic.
 *
 * Kept free of any database or Nest import so the rules can be read, and
 * tested, on their own.
 */

const KIGALI_OFFSET = '+02:00';
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-10-08`: a stored day. */
export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** `07:30`: a wall clock time, to the minute. */
export function isClock(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** The Kigali day an instant falls on. */
export function kigaliDay(at: Date = new Date()): string {
  return new Date(at.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Kigali wall clock at an instant, `07:30`. */
export function kigaliClock(at: Date): string {
  return new Date(at.getTime() + KIGALI_OFFSET_MS).toISOString().slice(11, 16);
}

/** The instant a wall clock time on a Kigali day names. */
export function atKigali(day: string, clock: string): Date {
  return new Date(`${day}T${clock.slice(0, 5)}:00${KIGALI_OFFSET}`);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** How many days `b` is after `a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** The Monday of the week a day sits in: rosters are written a week at a time. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Postgres hands a `time` back as `07:30:00`; the wire carries `07:30`. */
export function toClock(time: string): string {
  return time.slice(0, 5);
}

/** A shift that ends at or before it starts runs into the next morning. */
export function isOvernight(startTime: string, endTime: string): boolean {
  return toClock(endTime) <= toClock(startTime);
}

/** When a shift on a given day really starts and ends. */
export function shiftWindow(day: string, startTime: string, endTime: string): { start: Date; end: Date } {
  const start = atKigali(day, startTime);
  const end = atKigali(isOvernight(startTime, endTime) ? addDays(day, 1) : day, endTime);
  return { start, end };
}

/** How long a shift is, whatever day it falls on. */
export function shiftMinutes(startTime: string, endTime: string): number {
  const { start, end } = shiftWindow('2026-01-01', startTime, endTime);
  return minutesBetween(start, end);
}

/** Whole minutes from `a` to `b`, never negative. */
export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60_000));
}

/**
 * Minutes late, as the record keeps it: nothing inside the grace, and the
 * WHOLE distance from the scheduled start once past it. Twelve minutes after a
 * shift with ten minutes' grace is twelve minutes late, not two.
 */
export function lateMinutes(clockIn: Date, scheduledStart: Date | null, graceMinutes: number): number {
  if (!scheduledStart) return 0;
  const past = Math.floor((clockIn.getTime() - scheduledStart.getTime()) / 60_000);
  return past > graceMinutes ? past : 0;
}
