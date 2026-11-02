import type { BrokerBookingPayment, BrokerGroupStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  bookings,
  brokerBookingGroups,
  escrows,
  roomTypes,
  threads,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { PaymentReceipt } from '../../pay/domain/payment-port';
import { makeReference } from '../domain/pricing';
import { readNightlyCapacity } from './sellable-capacity.query';

/** One room type a broker may book at a hotel, as the database has it. */
export interface BrokerRoomTypeRow {
  id: string;
  name: string;
  workspaceId: string;
  capacity: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  priceBasis: string | null;
  nightlyRateRwf: number | null;
  singleGuestPriceRwf: number | null;
  minStay: number | null;
  bookingMode: string | null;
  cancellationTier: string | null;
}

/** One room of a group as it was asked and priced: what `broker_booking_groups.rooms` holds. */
export interface GroupRoomLine {
  roomTypeId: string;
  roomTypeName: string;
  guestName: string;
  guestPhone: string | null;
  adults: number;
  children: number;
  /** What one night costs the whole party: the figure the booking locks. */
  lockedNightlyRwf: number;
  grossRwf: number;
  bookingMode: string;
  cancellationTier: string | null;
}

export interface GroupRow {
  id: string;
  reference: string;
  brokerId: string;
  dealId: string;
  orgId: string;
  workspaceId: string;
  checkIn: string;
  checkOut: string;
  payment: BrokerBookingPayment;
  status: BrokerGroupStatus;
  totalRwf: number;
  contactPhone: string;
  note: string | null;
  rooms: GroupRoomLine[];
  failureReason: string | null;
  createdAt: Date;
}

export interface GroupBookingRow {
  id: string;
  reference: string;
  status: string;
  roomTypeId: string;
  guestName: string | null;
}

/** A deal's stored terms (the columns `termsFromColumns` reads) and its hotel's name. */
export interface DealFacts {
  kind: 'percent' | 'bulk_fixed';
  percentBp: number | null;
  amountRwf: number | null;
  minRooms: number | null;
  hotelName: string;
}

/** The money behind a MoMo group, handed to the write once it landed. */
export interface GroupPayment {
  receipt: Pick<PaymentReceipt, 'adapterRef' | 'mode'>;
  /** The capture's key. Each room's escrow is keyed `<key>:<n>`, so a second write of the group conflicts. */
  idempotencyKey: string;
}

export type GroupWriteOutcome =
  | { kind: 'booked'; bookingIds: string[] }
  | { kind: 'already' }
  | { kind: 'sold_out'; roomTypeName: string }
  | { kind: 'not_waiting' };

const REFERENCE_RETRIES = 3;

function isReferenceCollision(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      ['bookings_reference_uk', 'broker_booking_groups_reference_uk'].includes(
        (e as { constraint?: string }).constraint ?? '',
      ),
  );
}

/** `BK-7Q2M-4XKD` → `BG-7Q2M-4XKD`: the same alphabet, so a group reads like a booking. */
function groupReference(): string {
  return `BG-${makeReference().slice(3)}`;
}

/** The fewest rooms free on any night of the window; zero for an empty window. */
export function fewestFree(nights: readonly { freeUnits: number }[]): number {
  return nights.length === 0 ? 0 : Math.min(...nights.map((n) => n.freeUnits));
}

/**
 * A broker's groups of rooms (0125). The write of a group's bookings is ONE transaction, as a single
 * booking's is: every room type in the group is locked (in id order, so two groups never deadlock), the
 * free rooms are counted under the lock, and every booking (and, paid by MoMo, its escrow share) is written
 * or none is. Live payment holds of other presses are counted, because a group claims none of its own.
 */
@Injectable()
export class BrokerGroupRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The bookable room types of a hotel: active, priced stays in its published properties. */
  async roomTypesOf(orgId: string): Promise<BrokerRoomTypeRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select rt.id, rt.name, rt.workspace_id, rt.capacity, rt.max_adults, rt.max_children, rt.price_basis::text as price_basis,
             rt.base_price_rwf, rt.single_guest_price_rwf, rt.min_stay, rt.booking_mode::text as booking_mode,
             rt.cancellation_tier::text as cancellation_tier
        from room_types rt
        join properties p on p.id = rt.property_id
        join listings l on l.property_id = p.id and l.status = 'published'
        join orgs o on o.id = p.org_id
       where p.org_id = ${orgId}
         and o.registration_status = 'active'
         and rt.status = 'active'
         and rt.domain = 'hospitality'
         and rt.base_price_rwf is not null
         and rt.booking_mode is not null
       order by rt.base_price_rwf, rt.name`);
    const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
    return result.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      workspaceId: String(r.workspace_id),
      capacity: n(r.capacity),
      maxAdults: n(r.max_adults),
      maxChildren: n(r.max_children),
      priceBasis: (r.price_basis as string | null) ?? null,
      nightlyRateRwf: n(r.base_price_rwf),
      singleGuestPriceRwf: n(r.single_guest_price_rwf),
      minStay: n(r.min_stay),
      bookingMode: (r.booking_mode as string | null) ?? null,
      cancellationTier: (r.cancellation_tier as string | null) ?? null,
    }));
  }

  /** Rooms of one type free on every night, counting live holds: the figure a broker is shown. */
  async freeRooms(roomTypeId: string, from: string, to: string): Promise<number> {
    return fewestFree(await readNightlyCapacity(this.db, { roomTypeId, from, to, now: new Date(), countHolds: true }));
  }

  async insertGroup(input: Omit<GroupRow, 'id' | 'reference' | 'failureReason' | 'createdAt'> & { createdByUserId: string }): Promise<GroupRow> {
    for (let i = 0; ; i++) {
      try {
        const [row] = await this.db
          .insert(brokerBookingGroups)
          .values({
            reference: groupReference(),
            brokerId: input.brokerId,
            dealId: input.dealId,
            orgId: input.orgId,
            workspaceId: input.workspaceId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            payment: input.payment,
            status: input.status,
            totalRwf: input.totalRwf,
            contactPhone: input.contactPhone,
            note: input.note,
            rooms: input.rooms,
            createdByUserId: input.createdByUserId,
          })
          .returning();
        if (!row) throw new Error('broker_booking_groups insert returned no row.');
        return toGroup(row);
      } catch (err) {
        if (!isReferenceCollision(err) || i >= REFERENCE_RETRIES) throw err;
      }
    }
  }

  async group(id: string): Promise<GroupRow | null> {
    const [row] = await this.db.select().from(brokerBookingGroups).where(eq(brokerBookingGroups.id, id)).limit(1);
    return row ? toGroup(row) : null;
  }

  async groupsOfBroker(brokerId: string): Promise<GroupRow[]> {
    const rows = await this.db
      .select()
      .from(brokerBookingGroups)
      .where(eq(brokerBookingGroups.brokerId, brokerId))
      .orderBy(sql`${brokerBookingGroups.createdAt} desc`)
      .limit(200);
    return rows.map(toGroup);
  }

  /** The bookings each group wrote, by group. */
  async bookingsOf(groupIds: string[]): Promise<Map<string, GroupBookingRow[]>> {
    const out = new Map<string, GroupBookingRow[]>();
    if (groupIds.length === 0) return out;
    const rows = await this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        roomTypeId: bookings.roomTypeId,
        guestName: bookings.guestName,
        groupId: bookings.brokerGroupId,
      })
      .from(bookings)
      .where(inArray(bookings.brokerGroupId, groupIds))
      .orderBy(bookings.createdAt);
    for (const r of rows) {
      if (!r.groupId) continue;
      const list = out.get(r.groupId) ?? [];
      list.push({ id: r.id, reference: r.reference, status: r.status, roomTypeId: r.roomTypeId, guestName: r.guestName });
      out.set(r.groupId, list);
    }
    return out;
  }

  /** Each deal's stored terms and its hotel's name, for the groups booked under them. */
  async dealFacts(dealIds: string[]): Promise<Map<string, DealFacts>> {
    const out = new Map<string, DealFacts>();
    if (dealIds.length === 0) return out;
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select bd.id, bd.kind::text as kind, bd.percent_bp, bd.amount_rwf, bd.min_rooms,
             coalesce((select p.name from properties p join listings l on l.property_id = p.id and l.status = 'published'
                        where p.org_id = o.id order by p.created_at limit 1), o.legal_name) as hotel_name
        from broker_hotel_deals bd join orgs o on o.id = bd.org_id
       where bd.id in (${sql.join(dealIds.map((id) => sql`${id}`), sql`, `)})`);
    const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
    for (const r of result.rows) {
      out.set(String(r.id), {
        kind: r.kind as DealFacts['kind'],
        percentBp: n(r.percent_bp),
        amountRwf: n(r.amount_rwf),
        minRooms: n(r.min_rooms),
        hotelName: String(r.hotel_name),
      });
    }
    return out;
  }

  /** A group still waiting for its payment that will not be booked: refused, unanswered or sold out. */
  async markFailed(id: string, reason: string): Promise<boolean> {
    const moved = await this.db
      .update(brokerBookingGroups)
      .set({ status: 'failed', failureReason: reason, updatedAt: new Date() })
      .where(and(eq(brokerBookingGroups.id, id), eq(brokerBookingGroups.status, 'awaiting_payment')))
      .returning({ id: brokerBookingGroups.id });
    return moved.length > 0;
  }

  /**
   * Write every room of a group as a confirmed booking, or none of them.
   *
   * Paid at the hotel, the group is written as it is created (`status` booked) and each booking carries no
   * payment. Paid by MoMo, the group waits `awaiting_payment` and this runs once the money landed: each
   * booking is `captured` with its own escrow row, keyed off the capture, so the poll and the sweep writing
   * the same group at once leave one set of bookings (`already` for the second).
   */
  async writeBookings(group: GroupRow, payment: GroupPayment | null): Promise<GroupWriteOutcome> {
    for (let i = 0; ; i++) {
      try {
        return await this.writeOnce(group, payment);
      } catch (err) {
        if (!isReferenceCollision(err) || i >= REFERENCE_RETRIES) throw err;
      }
    }
  }

  private async writeOnce(group: GroupRow, payment: GroupPayment | null): Promise<GroupWriteOutcome> {
    return this.db.transaction(async (tx): Promise<GroupWriteOutcome> => {
      // 1. Lock the group's room types in a fixed order.
      const typeIds = [...new Set(group.rooms.map((r) => r.roomTypeId))].sort();
      for (const id of typeIds) {
        await tx.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.id, id)).for('update');
      }

      // 2. Still waiting? Read under the lock: a second writer of the same group finds it booked.
      const [current] = await tx
        .select({ status: brokerBookingGroups.status })
        .from(brokerBookingGroups)
        .where(eq(brokerBookingGroups.id, group.id))
        .for('update');
      if (!current) return { kind: 'not_waiting' };
      if (current.status === 'booked') return { kind: 'already' };
      if (payment && current.status !== 'awaiting_payment') return { kind: 'not_waiting' };

      // 3. Enough rooms of each type on every night, counted under the lock.
      for (const id of typeIds) {
        const wanted = group.rooms.filter((r) => r.roomTypeId === id).length;
        const nights = await readNightlyCapacity(tx as unknown as Database, {
          roomTypeId: id,
          from: group.checkIn,
          to: group.checkOut,
          now: new Date(),
          countHolds: true,
        });
        if (fewestFree(nights) < wanted) {
          return { kind: 'sold_out', roomTypeName: group.rooms.find((r) => r.roomTypeId === id)?.roomTypeName ?? 'A room' };
        }
      }

      // 4. One booking per room, confirmed; and its share of the payment in escrow. The desk note says who
      //    booked it, so the front desk knows whom to call and that a commission rides on the stay.
      const broker = await tx.execute<Record<string, unknown>>(sql`select name, phone from brokers where id = ${group.brokerId}`);
      const brokerName = (broker.rows[0]?.name as string | null) ?? 'a broker';
      const deskNote = [`Booked by ${brokerName} (broker, ${group.reference}; call ${group.contactPhone}).`, group.note]
        .filter(Boolean)
        .join(' ');
      const bookingIds: string[] = [];
      for (const [n, room] of group.rooms.entries()) {
        const [booking] = await tx
          .insert(bookings)
          .values({
            reference: makeReference(),
            roomTypeId: room.roomTypeId,
            guestUserId: null,
            workspaceId: group.workspaceId,
            checkIn: group.checkIn,
            checkOut: group.checkOut,
            guestCount: room.adults + room.children,
            adults: room.adults,
            children: room.children,
            status: 'confirmed',
            bookingMode: room.bookingMode as typeof bookings.$inferInsert.bookingMode,
            lockedNightlyRateRwf: room.lockedNightlyRwf,
            lockedCancellationTier: room.cancellationTier as typeof bookings.$inferInsert.lockedCancellationTier,
            nonrefundable: false,
            grossRwf: room.grossRwf,
            paymentStatus: payment ? 'captured' : null,
            confirmedAt: new Date(),
            channel: 'travel_agent',
            deskNote,
            brokerGroupId: group.id,
            brokerId: group.brokerId,
            brokerDealId: group.dealId,
            guestName: room.guestName,
            guestPhone: room.guestPhone,
          })
          .returning({ id: bookings.id });
        if (!booking) throw new Error('Booking insert returned no row.');
        bookingIds.push(booking.id);

        if (payment) {
          const [escrow] = await tx
            .insert(escrows)
            .values({
              workspaceId: group.workspaceId,
              source: 'booking',
              bookingId: booking.id,
              amountRwf: room.grossRwf,
              status: 'held',
              adapterRef: payment.receipt.adapterRef,
              adapterMode: payment.receipt.mode,
              idempotencyKey: `${payment.idempotencyKey}:${n}`,
              attemptFingerprint: `broker-group:${group.id}:${n}`,
            })
            .onConflictDoNothing({ target: escrows.idempotencyKey })
            .returning({ id: escrows.id });
          // Already written by another writer of the same payment: roll this one back whole.
          if (!escrow) throw new GroupAlreadyWrittenError();
        }

        // The conversation the desk and the broker talk about this room in, as for any booking.
        await tx.insert(threads).values({ workspaceId: group.workspaceId, bookingId: booking.id });
      }

      await tx
        .update(brokerBookingGroups)
        .set({ status: 'booked', failureReason: null, updatedAt: new Date() })
        .where(eq(brokerBookingGroups.id, group.id));
      return { kind: 'booked', bookingIds };
    }).catch((err: unknown) => {
      if (err instanceof GroupAlreadyWrittenError) return { kind: 'already' } as const;
      throw err;
    });
  }
}

class GroupAlreadyWrittenError extends Error {
  constructor() {
    super('This group was already written by another writer of the same payment.');
  }
}

function toGroup(row: typeof brokerBookingGroups.$inferSelect): GroupRow {
  return {
    id: row.id,
    reference: row.reference,
    brokerId: row.brokerId,
    dealId: row.dealId,
    orgId: row.orgId,
    workspaceId: row.workspaceId,
    checkIn: String(row.checkIn),
    checkOut: String(row.checkOut),
    payment: row.payment,
    status: row.status,
    totalRwf: row.totalRwf,
    contactPhone: row.contactPhone,
    note: row.note ?? null,
    rooms: row.rooms as GroupRoomLine[],
    failureReason: row.failureReason ?? null,
    createdAt: row.createdAt,
  };
}
