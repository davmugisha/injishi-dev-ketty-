/**
 * The formatting the trip screens share. Pure functions taking `t`, so a test
 * can assert a sentence in either catalogue without rendering anything — the
 * same shape `./listing-format` takes, and for the same reason.
 */
import type { MessageKey, Translate } from '@/i18n/i18n';
import { formatDay } from '@/data/search';
import {
  arrivalAt,
  checkInGate,
  type CheckInGate,
  type Trip,
} from '@/data/trips';
import { REVIEW_CATEGORIES, overallFromScores, type CategoryScores } from '@/data/trip-reviews';

/* ------------------------------------------------------------ the clock --- */

/**
 * How long until an instant, in the largest unit that still reads as a number a
 * person can act on.
 *
 * Four units rather than one, because "in 172,800 seconds" and "in 2 days" are
 * the same fact and only one of them helps somebody decide whether to leave.
 * Days round rather than truncate: a stay 1 day 20 hours away reads "in 2
 * days", which is what a person would say.
 *
 * `now` is a parameter with no default on purpose. Every caller either has a
 * ticking clock or is a test, and a hidden `Date.now()` inside a formatter is
 * how a snapshot test starts failing at midnight.
 */
export type CountdownUnit = 'now' | 'minutes' | 'hours' | 'days';

export interface CountdownReading {
  unit: CountdownUnit;
  value: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function countdownTo(target: number, now: number): CountdownReading {
  const remaining = target - now;
  if (remaining <= MINUTE) return { unit: 'now', value: 0 };
  if (remaining < HOUR) return { unit: 'minutes', value: Math.floor(remaining / MINUTE) };
  if (remaining < DAY) return { unit: 'hours', value: Math.floor(remaining / HOUR) };
  return { unit: 'days', value: Math.round(remaining / DAY) };
}

/**
 * The countdown as a sentence.
 *
 * Singular and plural are separate keys rather than one string with a count in
 * it, because Kinyarwanda does not inflect the way English does and a shared
 * "{count} days" would read wrong in one catalogue or the other. Six keys is
 * cheap; a sentence that is subtly wrong in the reader's own language is not.
 */
export function countdownKey(reading: CountdownReading): MessageKey {
  if (reading.unit === 'now') return 'trips.countdownNow';
  if (reading.unit === 'minutes') {
    return reading.value === 1 ? 'trips.countdownMinute' : 'trips.countdownMinutes';
  }
  if (reading.unit === 'hours') {
    return reading.value === 1 ? 'trips.countdownHour' : 'trips.countdownHours';
  }
  return reading.value === 1 ? 'trips.countdownDay' : 'trips.countdownDays';
}

export function countdownText(target: number, now: number, t: Translate): string {
  const reading = countdownTo(target, now);
  return t(countdownKey(reading), { count: reading.value });
}

/* ------------------------------------------------------------- the dates --- */

/** `4 Sep – 7 Sep`, in the reader's own month names. */
export function tripDates(trip: Trip, t: Translate): string {
  return `${formatDay(trip.checkInDay, t)} – ${formatDay(trip.checkOutDay, t)}`;
}

/** `3 nights`, or `1 night`. Same split as `nightsLabel`, and the same reason. */
export function nightsText(nights: number, t: Translate): string {
  return nights === 1 ? t('trips.night') : t('trips.nights', { count: nights });
}

/** `4 Sep – 7 Sep · 3 nights`, the line under every trip's title. */
export function tripDateLine(trip: Trip, t: Translate): string {
  return `${tripDates(trip, t)} · ${nightsText(trip.nights, t)}`;
}

/** `Check-in 4 Sep, from 14:00`. The detail screen's fact row. */
export function checkInText(trip: Trip, t: Translate): string {
  return t('trip.dayFromTime', { day: formatDay(trip.checkInDay, t), time: trip.checkInTime });
}

export function checkOutText(trip: Trip, t: Translate): string {
  return t('trip.dayByTime', { day: formatDay(trip.checkOutDay, t), time: trip.checkOutTime });
}

/* -------------------------------------------------------------- the gate --- */

/**
 * What the arrival-guide card says while it is locked, and what its button —
 * if it has one — does.
 *
 * The gate itself lives in `@/data/trips` because it is a fact about the
 * booking; this is the COPY for each of its answers, which is a fact about the
 * screen. Keeping them apart is what lets the trip card, the detail screen and
 * the hero all read one gate and each say it in their own voice.
 */
export interface GateCopy {
  /** The sentence in the locked card. */
  bodyKey: MessageKey;
  /** The CTA, or null where the guest has nothing to press. */
  ctaKey: MessageKey | null;
}

export function gateCopy(gate: CheckInGate): GateCopy {
  switch (gate.kind) {
    case 'open':
      return { bodyKey: 'trip.arrivalUnlocked', ctaKey: 'trip.openArrivalGuide' };
    case 'ready':
      return { bodyKey: 'trip.arrivalLocked', ctaKey: 'trip.startCheckIn' };
    case 'early':
      return { bodyKey: 'trip.arrivalEarly', ctaKey: null };
    case 'staffed':
      return { bodyKey: 'trip.arrivalStaffed', ctaKey: null };
    case 'awaiting':
      return { bodyKey: 'trip.arrivalAwaiting', ctaKey: null };
    case 'closed':
      return { bodyKey: 'trip.arrivalClosed', ctaKey: null };
  }
}

/**
 * The hero card's whole state, in one object.
 *
 * The card draws a photograph, a countdown, a status and at most one button,
 * and which of those four appear depends on the same gate the detail screen
 * reads. Computing it here rather than in JSX is what makes it testable and
 * what stops the card and the screen drifting apart.
 */
export interface HeroState {
  trip: Trip;
  gate: CheckInGate;
  /** The instant the countdown runs to: arrival, always. */
  target: number;
  /** `true` once the guest is in the property; the countdown is spent. */
  inHouse: boolean;
  copy: GateCopy;
}

export function heroState(trip: Trip, now: number): HeroState {
  const gate = checkInGate(trip, now);
  return {
    trip,
    gate,
    target: arrivalAt(trip),
    inHouse: gate.kind === 'open',
    copy: gateCopy(gate),
  };
}

/* ------------------------------------------------------------ the review --- */

/** `4.5 of 5`, for a stay that has already been reviewed. */
export function overallText(scores: CategoryScores, t: Translate): string {
  return t('review.outOfFive', { score: overallFromScores(scores).toFixed(1) });
}

/**
 * One sentence a screen reader hears for the whole star row.
 *
 * A row of five buttons announces five times over; this is what the group says
 * instead, so a reader hears "Cleanliness, 4 of 5 stars" once and then moves on
 * rather than counting.
 */
export function starsSpokenLabel(label: string, value: number, t: Translate): string {
  return value === 0
    ? t('review.a11yUnrated', { category: label })
    : t('review.a11yRated', { category: label, count: value });
}

/**
 * `Samuel Kayitare` -> `Samuel K.`
 *
 * F-B14 §6: an individual review shows as first name plus last initial. It is
 * here rather than in the sheet because it is the rule about how a review is
 * ATTRIBUTED, which the property page will need too.
 */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last ? `${first} ${last[0]}.` : first;
}

/** How many of the six still need a tap. Printed under the submit button. */
export function unratedCount(scores: CategoryScores): number {
  return REVIEW_CATEGORIES.filter((key) => scores[key] === 0).length;
}
