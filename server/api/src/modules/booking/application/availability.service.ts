import {
  MAX_HORIZON_DAYS,
  MAX_NIGHTS,
  type RoomAvailability,
} from '@injishi/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ListingService } from '../../listing/application/listing.service';
import { daysFromToday, isCalendarDate, localToday } from '../domain/pricing';
import { BookingRepository } from '../infrastructure/booking.repository';

/**
 * What is left to sell, per night (ADR-047 wave E).
 *
 * ## The gap this closes
 *
 * `BookingRepository.freeUnits` has been correct since the table was created
 * and was reachable from exactly one place: inside `BookingService.create`, as
 * a pre-check no client could see. So the calendar offered sold-out nights, the
 * widget priced them, the guest chose a payment method — and the first anyone
 * said "that room is gone" was a 409 on the last click, after a charge had been
 * attempted and compensated. The room was never available; only the screen said
 * otherwise.
 *
 * ## Why the window is capped rather than trusted
 *
 * This is an UNAUTHENTICATED read that runs a `generate_series` join per call.
 * An uncapped `to` is a one-line denial of service — `from=2020-01-01` and
 * `to=2200-01-01` is sixty-five thousand rows per request from anyone with
 * curl. The cap is the booking horizon plus a stay, because no honest calendar
 * needs to ask about a night nothing can be booked on.
 */
@Injectable()
export class AvailabilityService {
  /**
   * The longest window one call may ask about.
   *
   * Derived rather than picked: the furthest useful night is the last one a
   * booking made today could still cover — the horizon, plus the longest stay
   * allowed to start on it. A calendar that wants more is not a calendar.
   */
  static readonly MAX_WINDOW_NIGHTS = MAX_HORIZON_DAYS + MAX_NIGHTS;

  constructor(
    private readonly bookings: BookingRepository,
    private readonly listings: ListingService,
  ) {}

  async forRoomType(
    roomTypeId: string,
    from: string,
    to: string,
  ): Promise<RoomAvailability> {
    if (!isCalendarDate(from) || !isCalendarDate(to)) {
      throw new BadRequestException('from and to must be real dates, yyyy-mm-dd.');
    }
    if (to <= from) {
      throw new BadRequestException('to must be after from.');
    }

    /*
     * The room type is resolved through `ListingService`, not read here.
     *
     * That is the architecture.md invariant — modules talk through application
     * services — and it also buys the visibility rule for free: `getBookableRoom`
     * answers only for an ACTIVE room type on a PUBLISHED listing, so this route
     * cannot be used to enumerate availability on somebody's unpublished
     * inventory by guessing uuids.
     */
    const room = await this.listings.getBookableRoom(roomTypeId);
    if (room.roomType.domain !== 'hospitality') {
      // A residence unit is never bookable as a stay (FL06 §5C), so it has no
      // nightly availability to report. Same answer as an unknown room type.
      throw new NotFoundException('That room is no longer offered.');
    }

    const window = nightsBetweenDates(from, to);
    if (window > AvailabilityService.MAX_WINDOW_NIGHTS) {
      throw new BadRequestException(
        `Ask for at most ${AvailabilityService.MAX_WINDOW_NIGHTS} nights at a time.`,
      );
    }

    /*
     * The past is not "sold out", it is not for sale.
     *
     * A calendar asking for a window that starts last month gets those nights
     * back as zero free, which is the truthful answer for a night nobody can
     * book — and it keeps the client from having to special-case the boundary
     * between "behind us" and "taken".
     */
    const today = localToday();
    const start = from < today ? today : from;

    const nights =
      start >= to
        ? []
        : await this.bookings.freeUnitsByNight(
            roomTypeId,
            start,
            to,
          );

    const past: { night: string; freeUnits: number }[] = [];
    for (let d = from; d < start; d = nextDay(d)) {
      past.push({ night: d, freeUnits: 0 });
    }

    // Beyond the booking horizon nothing can be sold either, whatever the
    // bookings table says about it.
    const horizonCapped = nights.map((night) =>
      daysFromToday(night.night) > MAX_HORIZON_DAYS
        ? { ...night, freeUnits: 0 }
        : night,
    );

    return {
      roomTypeId,
      roomCount: room.roomType.roomCount,
      minStay: room.roomType.minStay ?? 1,
      nights: [...past, ...horizonCapped],
    };
  }
}

/** Whole days between two `yyyy-mm-dd`, which is the night count. */
function nightsBetweenDates(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

/** The next calendar day, as `yyyy-mm-dd`. */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
