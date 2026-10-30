import type {
  BookingStatus,
  CancellationTier,
  PaymentStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';

import {
  bookings,
  districts,
  properties,
  roomTypes,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** One booking as its own guest needs to see it, before any date reasoning. */
export interface GuestTripRow {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  grossRwf: number | null;
  nonRefundable: boolean;
  cancellationTier: CancellationTier | null;
  createdAt: Date;
  propertyName: string;
  propertySlug: string | null;
  districtName: string | null;
  timezone: string;
  roomTypeName: string;
}

/**
 * The guest's own stays, read in one query.
 *
 * SEPARATE FROM `BookingRepository` on purpose, and the reason is the size of
 * that file: 34 KB covering creation, holds, sweeps, approvals and receipts,
 * every method of it a WRITE path or an operator read. A guest asking "what have
 * I booked?" shares none of that machinery, and adding a thirteenth concern to
 * the busiest file in the module is how a repository becomes unreviewable.
 *
 * IT JOINS RATHER THAN RETURNING IDS. A trip card needs the property's name,
 * its district and its room type; returning three ids and letting the client
 * fetch them would be three round trips over a hotel connection to render one
 * card. The joins are all `innerJoin` except the district, which is nullable on
 * `properties` — a property mid-registration may not have one yet, and a stay at
 * it is still a stay.
 *
 * IT IS SCOPED BY `guestUserId` IN THE QUERY ITSELF, not by a filter after the
 * fact. That is the whole security property of this file: there is no code path
 * here that can return a row belonging to somebody else, because the caller
 * cannot ask for one. `me.controller.ts` passes the id off the session, never
 * off the request body.
 */
@Injectable()
export class GuestTripsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Every booking this guest holds, newest first.
   *
   * Ordered by `createdAt` rather than by `checkIn` because the question a
   * person opens this page with is usually about the thing they just did. The
   * stages the service derives are what group them by calendar.
   */
  async findForGuest(guestUserId: string, limit = 100): Promise<GuestTripRow[]> {
    return this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        guests: bookings.guestCount,
        grossRwf: bookings.grossRwf,
        nonRefundable: bookings.nonrefundable,
        cancellationTier: bookings.lockedCancellationTier,
        createdAt: bookings.createdAt,
        propertyName: properties.name,
        propertySlug: properties.slug,
        districtName: districts.name,
        timezone: properties.timezone,
        roomTypeName: roomTypes.name,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(eq(bookings.guestUserId, guestUserId))
      .orderBy(desc(bookings.createdAt))
      .limit(limit);
  }
}
