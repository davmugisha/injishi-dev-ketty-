import type { BookingMode, CancellationTier, DeskReservationChannel } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

import { bookingDeskDetails, bookings, roomTypes } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { makeReference } from '../domain/pricing';
import { hasFreeUnitEveryNight } from '../domain/sellable-capacity';
import { NoAvailabilityError } from './booking.repository';
import { readNightlyCapacity } from './sellable-capacity.query';

export interface DeskBookingRow {
  workspaceId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  lockedNightlyRateRwf: number;
  grossRwf: number;
  cancellationTier: CancellationTier | null;
  bookingMode: BookingMode;
  channel: DeskReservationChannel;
  eta: string | null;
  note: string | null;
  guest: {
    fullName: string;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    documentType: 'national_id' | 'passport' | 'other' | null;
    idNumber: string | null;
  };
  holdUntil: Date | null;
  rateOverrideReason: string | null;
  createdByUserId: string;
}

const REFERENCE_RETRIES = 3;

/** A unique violation on the booking reference, and nothing else: the one collision worth a fresh draw. */
function isReferenceCollision(err: unknown): boolean {
  return [err, (err as { cause?: unknown })?.cause].some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint === 'bookings_reference_uk',
  );
}

/**
 * The desk's own bookings (0124): written in ONE transaction with the row lock on the room type that the
 * guest's online booking takes, so the desk and the marketplace can never both sell the last room.
 */
@Injectable()
export class DeskReservationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Whether the room type has a unit free on every night, counting live holds (read, not locked). */
  async available(roomTypeId: string, from: string, to: string): Promise<boolean> {
    const nights = await readNightlyCapacity(this.db, { roomTypeId, from, to, now: new Date() });
    return hasFreeUnitEveryNight(nights);
  }

  /**
   * The rooms of a type the desk can hold for these nights: open for guests, held for nobody on any of
   * them, and with no guest staying past the arrival.
   */
  async freeRooms(roomTypeId: string, from: string, to: string): Promise<{ id: string; label: string }[]> {
    const rows = await this.db.execute(sql`
      SELECT r.id, coalesce(r.label, 'Room') AS label
        FROM rooms r
       WHERE r.room_type_id = ${roomTypeId}
         AND r.status = 'available'
         AND NOT EXISTS (
           SELECT 1 FROM room_assignments ra
            WHERE ra.room_id = r.id AND ra.status = 'assigned'
              AND ra.occupies && daterange(${from}::date, ${to}::date))
         AND NOT EXISTS (
           SELECT 1 FROM guest_stays s
            WHERE s.room_id = r.id AND s.lifecycle = 'open'
              AND (s.planned_exit_at IS NULL OR s.planned_exit_at::date > ${from}::date))
       ORDER BY length(coalesce(r.label, '')), r.label`);
    return (rows.rows as { id: string; label: string }[]).map((r) => ({ id: r.id, label: r.label }));
  }

  /** Write the booking and who it is for, once the room type still has a unit on every night. */
  async create(input: DeskBookingRow): Promise<{ id: string; reference: string }> {
    for (let i = 0; ; i++) {
      try {
        return await this.createOnce(input, makeReference());
      } catch (err) {
        if (!isReferenceCollision(err) || i >= REFERENCE_RETRIES) throw err;
      }
    }
  }

  private async createOnce(input: DeskBookingRow, reference: string): Promise<{ id: string; reference: string }> {
    return this.db.transaction(async (tx) => {
      // The same lock the online booking takes: one writer per room type at a time.
      await tx.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.id, input.roomTypeId)).for('update');
      const nights = await readNightlyCapacity(tx, {
        roomTypeId: input.roomTypeId,
        from: input.checkIn,
        to: input.checkOut,
        now: new Date(),
      });
      if (!hasFreeUnitEveryNight(nights)) throw new NoAvailabilityError();

      const [booking] = await tx
        .insert(bookings)
        .values({
          reference,
          roomTypeId: input.roomTypeId,
          guestUserId: null,
          workspaceId: input.workspaceId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestCount: input.adults + input.children,
          adults: input.adults,
          children: input.children,
          channel: input.channel,
          eta: input.eta,
          deskNote: input.note,
          status: 'confirmed',
          bookingMode: input.bookingMode,
          lockedNightlyRateRwf: input.lockedNightlyRateRwf,
          lockedCancellationTier: input.cancellationTier,
          nonrefundable: false,
          grossRwf: input.grossRwf,
          // No money moved online: a deposit the desk takes goes on the bill.
          paymentStatus: null,
          confirmedAt: new Date(),
        })
        .returning({ id: bookings.id, reference: bookings.reference });
      if (!booking) throw new Error('A desk booking was written and could not be read back.');

      await tx.insert(bookingDeskDetails).values({
        bookingId: booking.id,
        workspaceId: input.workspaceId,
        guestName: input.guest.fullName,
        guestPhone: input.guest.phone,
        guestEmail: input.guest.email,
        nationality: input.guest.nationality,
        documentType: input.guest.documentType,
        idNumber: input.guest.idNumber,
        holdUntil: input.holdUntil,
        rateOverrideReason: input.rateOverrideReason,
        createdByUserId: input.createdByUserId,
      });
      return booking;
    });
  }

  /**
   * Holds that ran out: confirmed desk bookings past their `hold_until` that nobody checked in. Each is
   * cancelled with nothing to refund (no money moved online), which frees its nights.
   */
  async releaseExpiredHolds(now: Date): Promise<{ id: string; reference: string }[]> {
    const rows = await this.db
      .select({ id: bookings.id, reference: bookings.reference })
      .from(bookingDeskDetails)
      .innerJoin(bookings, eq(bookings.id, bookingDeskDetails.bookingId))
      .where(
        and(
          isNotNull(bookingDeskDetails.holdUntil),
          lt(bookingDeskDetails.holdUntil, now),
          eq(bookings.status, 'confirmed'),
          sql`NOT EXISTS (SELECT 1 FROM guest_stays s WHERE s.booking_id = ${bookings.id})`,
        ),
      );
    const released: { id: string; reference: string }[] = [];
    for (const row of rows) {
      const [done] = await this.db
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: 'host',
          refundRwf: 0,
          cancelReason: 'The hold ended before the guest confirmed.',
        })
        .where(and(eq(bookings.id, row.id), eq(bookings.status, 'confirmed')))
        .returning({ id: bookings.id });
      if (done) released.push(row);
    }
    return released;
  }
}
