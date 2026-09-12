import type { BookingStatus, GuestTrip, MyTrips, TripStage } from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { localToday, nightsBetween } from '../domain/pricing';
import {
  GuestTripsRepository,
  type GuestTripRow,
} from '../infrastructure/guest-trips.repository';

/**
 * "What have I booked?" — the guest's own answer (`GET /api/v1/me/trips`).
 *
 * The whole of this service is one read plus one derivation, and the derivation
 * is the part worth reviewing: which stage a stay is in.
 *
 * NOTHING IS RECOMPUTED. The price, the tier and the refundability come off the
 * booking row exactly as stored, because they were LOCKED at sale (D8,
 * `ui-rules.md` § Money & Dates). A service that helpfully re-derived a total
 * here would eventually disagree with the charge, and the guest would be reading
 * a number nobody had agreed to.
 */

/** Statuses that end a booking, whatever its dates still say. */
const ENDED: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'declined',
  'cancelled',
]);

/**
 * Which stage a stay is in, against today in the PROPERTY's calendar.
 *
 * Two rules, in this order, and the order is the point:
 *
 * 1. **A dead booking is never "upcoming".** A declined or cancelled stay whose
 *    dates are still ahead would otherwise sit at the top of the list under
 *    "Upcoming", which is how a person packs for a room they no longer hold.
 * 2. **`no_show` is in the past**, not cancelled. It happened — the room was
 *    held, the money moved, nobody arrived — and a guest disputing one needs to
 *    find it where the stay's dates put it, not filed under "cancelled" as
 *    though it never existed.
 *
 * Dates compare as `yyyy-mm-dd` strings, which is why `localToday` is used
 * rather than a `Date`: ISO order is lexical order, so no arithmetic, no
 * timezone drift at the boundary, and check-out day itself still counts as
 * `in_progress` (a guest leaving this morning has not finished their stay).
 */
export function tripStage(
  row: Pick<GuestTripRow, 'status' | 'checkIn' | 'checkOut'>,
  today: string,
): TripStage {
  if (ENDED.has(row.status)) return 'cancelled';
  if (row.checkOut < today) return 'past';
  if (row.checkIn > today) return 'upcoming';
  return 'in_progress';
}

@Injectable()
export class GuestTripsService {
  constructor(private readonly trips: GuestTripsRepository) {}

  async forGuest(guestUserId: string): Promise<MyTrips> {
    const rows = await this.trips.findForGuest(guestUserId);
    // One `today` for the whole list, so two cards cannot land on different
    // sides of midnight while the response is being built.
    const today = localToday();
    return { trips: rows.map((row) => toTrip(row, today)) };
  }
}

function toTrip(row: GuestTripRow, today: string): GuestTrip {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    paymentStatus: row.paymentStatus,
    stage: tripStage(row, today),
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: nightsBetween(row.checkIn, row.checkOut),
    guests: row.guests,
    propertyName: row.propertyName,
    propertySlug: row.propertySlug,
    districtName: row.districtName,
    roomTypeName: row.roomTypeName,
    timezone: row.timezone,
    grossRwf: row.grossRwf,
    nonRefundable: row.nonRefundable,
    cancellationTier: row.cancellationTier,
    bookedAt: row.createdAt.toISOString(),
  };
}
