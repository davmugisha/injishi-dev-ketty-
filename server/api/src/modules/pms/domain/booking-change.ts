import { chargedGuests, MAX_HORIZON_DAYS, MAX_NIGHTS, nightlyRateFor } from '@injishi/contracts';

/**
 * A change the desk makes to a confirmed reservation (2026-10-30): its dates, its room type, its party.
 * Pure, so the price a change comes to and the reasons it is refused are tested without a database.
 */

/** The reservation as it stands. */
export interface ChangeSubject {
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  adults: number;
  children: number;
  /** The party's nightly charge the booking locked (the per-guest rate times the guests, or the room's). */
  lockedNightlyRwf: number;
  /** How the booking's own room type is priced. */
  priceBasis: string | null;
  /** The room money held for it, once a change has recorded it; null before the first. */
  paidRoomRwf: number | null;
  refundRwf: number | null;
}

/** The room type it moves to (or stays in), priced the way a new booking is. */
export interface ChangeTarget {
  id: string;
  nightlyRateRwf: number;
  singleGuestPriceRwf: number | null;
  priceBasis: string | null;
  capacity: number;
  maxAdults: number | null;
  maxChildren: number | null;
  minStay: number | null;
}

/** What the desk asked for. */
export interface ChangeAsk {
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  adults: number;
  children: number;
}

export interface ChangePrice {
  nights: number;
  fromNightlyRwf: number;
  toNightlyRwf: number;
  /** What the guest has paid for the room before this change. */
  paidRoomRwf: number;
  /** What the room costs after it. */
  newRoomRwf: number;
  /** More owed when positive; credit when negative. */
  differenceRwf: number;
}

const DAY_MS = 86_400_000;

export function nightsBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * The room money paid for a booking: what a change recorded, else the locked nightly charge times the
 * nights, less any refund (the figure the bill has always credited at check in, `prepaidRoomRwf`).
 */
export function paidRoomOf(s: Pick<ChangeSubject, 'checkIn' | 'checkOut' | 'lockedNightlyRwf' | 'paidRoomRwf' | 'refundRwf'>): number {
  if (s.paidRoomRwf != null) return s.paidRoomRwf;
  const nights = nightsBetween(s.checkIn, s.checkOut);
  return Math.max(0, s.lockedNightlyRwf * Math.max(0, nights) - (s.refundRwf ?? 0));
}

/**
 * The nightly charge after the change.
 *
 * - Same room type, and the party does not change what the room costs: the booking's own locked charge,
 *   so a stay moved to other dates keeps the price it was sold at.
 * - Same room type priced per guest, a different party: the booking's own per-guest rate times the new
 *   party.
 * - Same room type priced per room, crossing one guest and two or more: the room type's price for the new
 *   party (its one-guest price applies to one guest only, 0117).
 * - Another room type: that room type's price for the party, as a new booking would pay.
 */
export function nightlyAfter(s: ChangeSubject, target: ChangeTarget, ask: ChangeAsk): number {
  const before = s.adults + s.children;
  const after = ask.adults + ask.children;
  if (target.id !== s.roomTypeId) {
    return nightlyRateFor(target, after) * chargedGuests(target.priceBasis as never, after);
  }
  if (s.priceBasis === 'per_unit') {
    const sameBracket = (before === 1) === (after === 1);
    return sameBracket ? s.lockedNightlyRwf : nightlyRateFor(target, after);
  }
  const perGuest = Math.round(s.lockedNightlyRwf / chargedGuests(s.priceBasis as never, before));
  return perGuest * chargedGuests(s.priceBasis as never, after);
}

export function priceChange(s: ChangeSubject, target: ChangeTarget, ask: ChangeAsk): ChangePrice {
  const nights = nightsBetween(ask.checkIn, ask.checkOut);
  const toNightlyRwf = nightlyAfter(s, target, ask);
  const paidRoomRwf = paidRoomOf(s);
  const newRoomRwf = toNightlyRwf * Math.max(0, nights);
  return {
    nights,
    fromNightlyRwf: s.lockedNightlyRwf,
    toNightlyRwf,
    paidRoomRwf,
    newRoomRwf,
    differenceRwf: newRoomRwf - paidRoomRwf,
  };
}

/** Why a change cannot be made, in the desk's words; empty when it can. Availability is checked apart. */
export function changeProblems(s: ChangeSubject, target: ChangeTarget, ask: ChangeAsk, today: string): string[] {
  const out: string[] = [];
  const nights = nightsBetween(ask.checkIn, ask.checkOut);
  const unchanged =
    ask.checkIn === s.checkIn &&
    ask.checkOut === s.checkOut &&
    ask.roomTypeId === s.roomTypeId &&
    ask.adults === s.adults &&
    ask.children === s.children;
  if (unchanged) out.push('Nothing is changed yet: pick new dates, another room type or a different party.');
  if (nights <= 0) out.push('Departure must be after arrival.');
  else if (nights > MAX_NIGHTS) out.push(`A stay is at most ${MAX_NIGHTS} nights.`);
  if (ask.checkIn < today) out.push('Arrival cannot be in the past.');
  if (nightsBetween(today, ask.checkIn) > MAX_HORIZON_DAYS) out.push('Stays open up to 18 months ahead.');
  if (target.minStay != null && nights > 0 && nights < target.minStay) {
    out.push(`That room type needs at least ${target.minStay} nights.`);
  }
  if (ask.adults < 1) out.push('A booking has at least one adult.');
  if (ask.children < 0) out.push('Children cannot be fewer than none.');
  if (ask.adults + ask.children > target.capacity) out.push(`That room type sleeps at most ${target.capacity}.`);
  if (target.maxAdults != null && ask.adults > target.maxAdults) {
    out.push(`That room type takes at most ${target.maxAdults} ${target.maxAdults === 1 ? 'adult' : 'adults'}.`);
  }
  if (target.maxChildren != null && ask.children > target.maxChildren) {
    out.push(
      target.maxChildren === 0
        ? 'That room type takes no children.'
        : `That room type takes at most ${target.maxChildren} ${target.maxChildren === 1 ? 'child' : 'children'}.`,
    );
  }
  return out;
}
