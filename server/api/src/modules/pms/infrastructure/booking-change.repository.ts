import type { ChangeSettlement, ReservationChangeAsk } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import {
  auditEvents,
  bookingChanges,
  bookings,
  escrows,
  guestStays,
  roomAssignments,
  roomTypes,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ChangePrice } from '../domain/booking-change';
import { hasFreeUnitEveryNight } from '../domain/sellable-capacity';
import { readNightlyCapacity } from './sellable-capacity.query';

/** A reservation as a change reads it, with what decides whether it may still change. */
export interface ChangeableBooking {
  id: string;
  reference: string;
  workspaceId: string;
  propertyId: string;
  guestUserId: string | null;
  status: string;
  paymentStatus: string | null;
  completed: boolean;
  /** Guest stays opened against it: a guest who has checked in is changed at the desk's bill, not here. */
  stays: number;
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  adults: number;
  children: number;
  lockedNightlyRwf: number;
  priceBasis: string | null;
  paidRoomRwf: number | null;
  refundRwf: number | null;
}

/** What a change applies, and the stay it was priced against (a stale price is refused, never applied). */
export interface ApplyChange {
  bookingId: string;
  workspaceId: string;
  /** The awaiting row a MoMo payment completes; absent for a change applied at once. */
  changeId?: string;
  from: Pick<ChangeableBooking, 'checkIn' | 'checkOut' | 'roomTypeId' | 'adults' | 'children' | 'lockedNightlyRwf'>;
  ask: ReservationChangeAsk;
  price: ChangePrice;
  settlement: ChangeSettlement;
  actorUserId: string | null;
  /** The guest's MoMo payment of the difference, held in escrow beside the booking's own. */
  payment?: { amountRwf: number; adapterRef: string; adapterMode: 'mock' | 'live'; idempotencyKey: string };
}

export type ApplyOutcome =
  | { kind: 'applied'; changeId: string }
  | { kind: 'sold_out' }
  /** The reservation moved, was checked in, or ended since it was priced. */
  | { kind: 'stale' };

const toInt = (v: unknown): number => Number(v ?? 0);

/**
 * A desk change to a confirmed reservation (migration 0120). Every write here happens under the room
 * types' row locks, the lock a new booking of them takes, so a change and a new booking can never both
 * have the last room.
 */
@Injectable()
export class BookingChangeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(bookingId: string): Promise<ChangeableBooking | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        workspaceId: bookings.workspaceId,
        propertyId: roomTypes.propertyId,
        guestUserId: bookings.guestUserId,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        completedAt: bookings.completedAt,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        roomTypeId: bookings.roomTypeId,
        adults: bookings.adults,
        children: bookings.children,
        guestCount: bookings.guestCount,
        lockedNightlyRwf: bookings.lockedNightlyRateRwf,
        priceBasis: roomTypes.priceBasis,
        paidRoomRwf: bookings.paidRoomRwf,
        refundRwf: bookings.refundRwf,
        stays: sql<number>`(select count(*)::int from ${guestStays} gs where gs.booking_id = ${bookings.id})`,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!row) return null;
    // A booking from before 0091 carries only its party size: every guest counts as an adult.
    const adults = row.adults ?? row.guestCount;
    return {
      id: row.id,
      reference: row.reference,
      workspaceId: row.workspaceId,
      propertyId: row.propertyId,
      guestUserId: row.guestUserId,
      status: row.status,
      paymentStatus: row.paymentStatus,
      completed: row.completedAt !== null,
      stays: toInt(row.stays),
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      roomTypeId: row.roomTypeId,
      adults,
      children: row.children ?? Math.max(0, row.guestCount - adults),
      lockedNightlyRwf: Number(row.lockedNightlyRwf),
      priceBasis: row.priceBasis ?? null,
      paidRoomRwf: row.paidRoomRwf === null ? null : Number(row.paidRoomRwf),
      refundRwf: row.refundRwf === null ? null : Number(row.refundRwf),
    };
  }

  /** The active room types of a property, in the order the setup lists them: what a change may move to. */
  async roomTypeIdsOf(propertyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, propertyId), eq(roomTypes.status, 'active')))
      .orderBy(asc(roomTypes.createdAt));
    return rows.map((r) => r.id);
  }

  /** Whether the room type has a unit every night of the stay, this booking left out. Read, not held. */
  async available(roomTypeId: string, from: string, to: string, excludeBookingId: string): Promise<boolean> {
    const nights = await readNightlyCapacity(this.db, {
      roomTypeId,
      from,
      to,
      now: new Date(),
      excludeBookingId,
    });
    return hasFreeUnitEveryNight(nights);
  }

  /** A change waiting on the guest's MoMo payment, written before the request goes to their phone. */
  async createAwaiting(input: Omit<ApplyChange, 'changeId' | 'payment' | 'settlement'>): Promise<string> {
    const [row] = await this.db
      .insert(bookingChanges)
      .values({ ...this.columns(input, 'momo'), status: 'awaiting_payment' })
      .returning({ id: bookingChanges.id });
    if (!row) throw new Error('A booking change was written and could not be read back.');
    return row.id;
  }

  async findChange(changeId: string): Promise<typeof bookingChanges.$inferSelect | null> {
    const [row] = await this.db.select().from(bookingChanges).where(eq(bookingChanges.id, changeId)).limit(1);
    return row ?? null;
  }

  /** The awaiting change, once its MoMo request was refused or ran out. Applied changes never move. */
  async abandon(changeId: string): Promise<void> {
    await this.db
      .update(bookingChanges)
      .set({ status: 'abandoned' })
      .where(and(eq(bookingChanges.id, changeId), eq(bookingChanges.status, 'awaiting_payment')));
  }

  /**
   * Apply a change in one transaction: the room types locked, the booking re-read under its lock and
   * compared with the stay it was priced against, the new room type's nights counted without this booking,
   * then the booking moved, the change recorded, a MoMo payment held in escrow, the rooms it held let go
   * when its dates or room type moved, and an audit row written.
   */
  async apply(input: ApplyChange): Promise<ApplyOutcome> {
    return this.db.transaction(async (tx) => {
      // The lock a new booking takes, in one order, so two changes cannot deadlock each other.
      const locked = [...new Set([input.from.roomTypeId, input.ask.roomTypeId])].sort();
      await tx.select({ id: roomTypes.id }).from(roomTypes).where(inArray(roomTypes.id, locked)).orderBy(asc(roomTypes.id)).for('update');

      const [now] = await tx
        .select({
          status: bookings.status,
          completedAt: bookings.completedAt,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          roomTypeId: bookings.roomTypeId,
          adults: bookings.adults,
          children: bookings.children,
          guestCount: bookings.guestCount,
          lockedNightlyRwf: bookings.lockedNightlyRateRwf,
          stays: sql<number>`(select count(*)::int from ${guestStays} gs where gs.booking_id = ${bookings.id})`,
        })
        .from(bookings)
        .where(eq(bookings.id, input.bookingId))
        .for('update');
      const adultsNow = now ? (now.adults ?? now.guestCount) : 0;
      const childrenNow = now ? (now.children ?? Math.max(0, now.guestCount - adultsNow)) : 0;
      if (
        !now ||
        now.status !== 'confirmed' ||
        now.completedAt !== null ||
        toInt(now.stays) > 0 ||
        now.checkIn !== input.from.checkIn ||
        now.checkOut !== input.from.checkOut ||
        now.roomTypeId !== input.from.roomTypeId ||
        adultsNow !== input.from.adults ||
        childrenNow !== input.from.children ||
        Number(now.lockedNightlyRwf) !== input.from.lockedNightlyRwf
      ) {
        return { kind: 'stale' };
      }

      const nights = await readNightlyCapacity(tx, {
        roomTypeId: input.ask.roomTypeId,
        from: input.ask.checkIn,
        to: input.ask.checkOut,
        now: new Date(),
        countHolds: true,
        excludeBookingId: input.bookingId,
      });
      if (!hasFreeUnitEveryNight(nights)) return { kind: 'sold_out' };

      const paidAfter = input.price.paidRoomRwf + (input.payment?.amountRwf ?? 0);
      await tx
        .update(bookings)
        .set({
          checkIn: input.ask.checkIn,
          checkOut: input.ask.checkOut,
          roomTypeId: input.ask.roomTypeId,
          adults: input.ask.adults,
          children: input.ask.children,
          guestCount: input.ask.adults + input.ask.children,
          lockedNightlyRateRwf: input.price.toNightlyRwf,
          paidRoomRwf: paidAfter,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, input.bookingId));

      const appliedAt = new Date();
      let changeId = input.changeId;
      if (changeId) {
        await tx
          .update(bookingChanges)
          .set({ status: 'applied', appliedAt })
          .where(and(eq(bookingChanges.id, changeId), eq(bookingChanges.status, 'awaiting_payment')));
      } else {
        const [row] = await tx
          .insert(bookingChanges)
          .values({ ...this.columns(input, input.settlement), status: 'applied', appliedAt })
          .returning({ id: bookingChanges.id });
        if (!row) throw new Error('A booking change was written and could not be read back.');
        changeId = row.id;
      }

      if (input.payment) {
        await tx
          .insert(escrows)
          .values({
            workspaceId: input.workspaceId,
            source: 'booking_change',
            bookingId: input.bookingId,
            amountRwf: input.payment.amountRwf,
            status: 'held',
            adapterRef: input.payment.adapterRef,
            adapterMode: input.payment.adapterMode,
            idempotencyKey: input.payment.idempotencyKey,
          })
          .onConflictDoNothing({ target: escrows.idempotencyKey });
      }

      // A room held for the old dates or the old room type is not the room for the new stay.
      const moved =
        input.ask.checkIn !== input.from.checkIn ||
        input.ask.checkOut !== input.from.checkOut ||
        input.ask.roomTypeId !== input.from.roomTypeId;
      if (moved) {
        await tx
          .update(roomAssignments)
          .set({ status: 'released', releasedAt: appliedAt, updatedAt: appliedAt })
          .where(and(eq(roomAssignments.bookingId, input.bookingId), eq(roomAssignments.status, 'assigned')));
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'booking',
        subjectId: input.bookingId,
        eventType: 'booking.changed',
        payloadDiff: {
          changeId,
          from: input.from,
          to: input.ask,
          paidRoomRwf: input.price.paidRoomRwf,
          newRoomRwf: input.price.newRoomRwf,
          differenceRwf: input.price.differenceRwf,
          settlement: input.settlement,
        } as never,
      });

      return { kind: 'applied', changeId };
    });
  }

  /**
   * What a guest paid by MoMo for changes to a booking that is now cancelled or a no-show (0120): marked
   * refunded in full and handed back, so the caller can queue each refund. The change money is refunded
   * whole, whatever the booking's own tier keeps: it paid for nights that will not be slept.
   */
  async takeChangePayments(bookingId: string): Promise<
    { escrowId: string; amountRwf: number; adapterRef: string | null; workspaceId: string; idempotencyKey: string }[]
  > {
    const rows = await this.db
      .update(escrows)
      .set({ status: 'refunded_full', updatedAt: new Date() })
      .where(and(eq(escrows.bookingId, bookingId), eq(escrows.source, 'booking_change'), eq(escrows.status, 'held')))
      .returning({
        escrowId: escrows.id,
        amountRwf: escrows.amountRwf,
        adapterRef: escrows.adapterRef,
        workspaceId: escrows.workspaceId,
        idempotencyKey: escrows.idempotencyKey,
      });
    return rows.map((r) => ({ ...r, amountRwf: Number(r.amountRwf), idempotencyKey: r.idempotencyKey ?? r.escrowId }));
  }

  /**
   * The credit a cheaper change left on the bill, still owed to the guest: the sum of every applied credit
   * change on the booking. What the bill already spent of it is the bill's own arithmetic.
   */
  async creditOwed(bookingId: string): Promise<number> {
    const [row] = await this.db
      .select({ credit: sql<number>`coalesce(-sum(${bookingChanges.differenceRwf}), 0)::bigint` })
      .from(bookingChanges)
      .where(
        and(
          eq(bookingChanges.bookingId, bookingId),
          eq(bookingChanges.status, 'applied'),
          eq(bookingChanges.settlement, 'credit'),
        ),
      );
    return Math.max(0, Number(row?.credit ?? 0));
  }

  private columns(
    input: Omit<ApplyChange, 'changeId' | 'payment' | 'settlement'>,
    settlement: ChangeSettlement,
  ): Omit<typeof bookingChanges.$inferInsert, 'status' | 'appliedAt'> {
    return {
      bookingId: input.bookingId,
      workspaceId: input.workspaceId,
      settlement,
      fromCheckIn: input.from.checkIn,
      fromCheckOut: input.from.checkOut,
      fromRoomTypeId: input.from.roomTypeId,
      fromAdults: input.from.adults,
      fromChildren: input.from.children,
      toCheckIn: input.ask.checkIn,
      toCheckOut: input.ask.checkOut,
      toRoomTypeId: input.ask.roomTypeId,
      toAdults: input.ask.adults,
      toChildren: input.ask.children,
      fromNightlyRwf: input.price.fromNightlyRwf,
      toNightlyRwf: input.price.toNightlyRwf,
      paidRoomRwf: input.price.paidRoomRwf,
      newRoomRwf: input.price.newRoomRwf,
      differenceRwf: input.price.differenceRwf,
      actorUserId: input.actorUserId,
    };
  }
}
