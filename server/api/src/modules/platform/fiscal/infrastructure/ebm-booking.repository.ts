import type {
  AdapterMode,
  BookingStatus,
  PaymentStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import {
  bookings,
  districts,
  escrows,
  orgs,
  properties,
  roomTypes,
  workspaces,
} from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { signPointOf, type SignPoint } from '../domain/sign-point';

/** Everything a receipt needs about one booking, in one read. */
export interface BookingForReceipt {
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  checkIn: string;
  checkOut: string;
  /** The rate this booking locked. Null on rows written before D8's snapshot. */
  lockedNightlyRateRwf: number | null;
  nonRefundable: boolean;
  /** What was actually charged. The receipt's `TOTAL` must equal this. */
  grossRwf: number | null;
  workspaceId: string;
  /** The org behind the workspace: whose EBM account certifies the sale. */
  orgId: string | null;
  roomTypeName: string;
  propertyName: string;
  /** The property's street line; the receipt header's first half. */
  addressText: string | null;
  /** The district, which is the "City" of the header's "Address, City". */
  districtName: string | null;
  /** The taxpayer. Null when the workspace is not a business workspace. */
  sellerLegalName: string | null;
  sellerTin: string | null;
  /**
   * Which side of the payment seam took the money. Read so the receipt can say
   * so rather than imply a real settlement — null when no escrow row exists.
   */
  paymentAdapterMode: AdapterMode | null;
  /** The instant the receipt is stamped with. See the service for the choice. */
  confirmedAt: Date | null;
  createdAt: Date;
  /**
   * The fiscal rule this booking was confirmed under (ADR-050 D-a), raw. Read
   * through `receiptSignPoint`, which decides between an `NS` and a `PS`.
   */
  ebmSignAt: string | null;
}

/**
 * The EBM module's own read of a booking (F-B05, and clause 13.1's header).
 *
 * Separate from `BookingRepository` on purpose, and not because it is tidier:
 * that repository answers the booking engine's questions — holds, attempts,
 * expiry sweeps — and this one answers a tax question. They need different
 * columns and different joins, and the day the receipt needs the taxpayer's
 * branch or its programmed rates, it is this query that grows.
 *
 * Every read is scoped by the GUEST as well as by the reference. A booking
 * reference is short and printed on things; treating it as a bearer token for
 * an invoice carrying a guest's stay dates and a business's TIN would be a
 * disclosure, and "not found" is the only honest answer to someone who does not
 * hold the booking — see the service, which never distinguishes the two.
 */
@Injectable()
export class EbmBookingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findGuestBooking(
    reference: string,
    guestUserId: string,
  ): Promise<BookingForReceipt | null> {
    return this.findOne(
      and(
        eq(bookings.reference, reference),
        eq(bookings.guestUserId, guestUserId),
      ),
    );
  }

  /**
   * The same read for the emission worker, keyed by the booking's id rather
   * than by the guest. The worker acts for the TAXPAYER, not for a guest — it
   * certifies every sale the business made — so there is no guest to scope by,
   * and the id it holds came from its own `ebm_invoices` row, not from a URL.
   * Also answers the org behind the workspace, which is whose EBM account signs.
   */
  async findForEmission(bookingId: string): Promise<BookingForReceipt | null> {
    return this.findOne(eq(bookings.id, bookingId));
  }

  /**
   * Record WHICH FISCAL RULE this booking was confirmed under (ADR-050 D-a).
   *
   * Written once, at confirmation, and never again: the `IS NULL` guard means a
   * second confirm attempt, a retry or a replay cannot re-stamp a booking under
   * a rule that changed in between. Whatever the flag says later, this booking
   * keeps the rule it was made under, which is the whole point of stamping
   * rather than reading the variable again at close.
   */
  async stampSignPoint(bookingId: string, signPoint: SignPoint): Promise<void> {
    await this.db
      .update(bookings)
      .set({ ebmSignAt: signPoint })
      .where(and(eq(bookings.id, bookingId), isNull(bookings.ebmSignAt)));
  }

  /** The rule this booking was confirmed under. Absent reads as `booking`. */
  async signPointFor(bookingId: string): Promise<SignPoint> {
    const [row] = await this.db
      .select({ stamp: bookings.ebmSignAt })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return signPointOf(row?.stamp);
  }

  private async findOne(
    where: ReturnType<typeof and>,
  ): Promise<BookingForReceipt | null> {
    const [row] = await this.db
      .select({
        reference: bookings.reference,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
        nonRefundable: bookings.nonrefundable,
        grossRwf: bookings.grossRwf,
        workspaceId: bookings.workspaceId,
        orgId: workspaces.orgId,
        roomTypeName: roomTypes.name,
        propertyName: properties.name,
        addressText: properties.addressText,
        districtName: districts.name,
        sellerLegalName: orgs.legalName,
        sellerTin: orgs.tin,
        paymentAdapterMode: escrows.adapterMode,
        confirmedAt: bookings.confirmedAt,
        createdAt: bookings.createdAt,
        ebmSignAt: bookings.ebmSignAt,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .innerJoin(workspaces, eq(workspaces.id, bookings.workspaceId))
      // Left, all three: a property with no district, or a workspace with no
      // org, is a data gap that must degrade the header rather than make the
      // receipt unreachable. The service decides what an incomplete seller
      // means; the query's job is to report it, not to hide it behind no rows.
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(orgs, eq(orgs.id, workspaces.orgId))
      .leftJoin(
        escrows,
        and(eq(escrows.bookingId, bookings.id), eq(escrows.source, 'booking')),
      )
      .where(where)
      // The reference is unique, so at most one booking matches; the escrow
      // join is what could multiply the row. Newest first and one row, so a
      // booking that was captured, compensated and re-captured reports the
      // mode that actually holds the money rather than an arbitrary one.
      .orderBy(desc(escrows.createdAt))
      .limit(1);

    return row ?? null;
  }
}
