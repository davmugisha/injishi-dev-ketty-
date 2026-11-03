import type { HousekeepingStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import {
  accountName,
  bookings,
  guestStays,
  properties,
  ratePlans,
  rooms,
  roomTypes,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import { makeStayReference, STAY_REFERENCE_INDEX } from '../domain/stay-reference';
import { enqueueCheckoutClean } from './housekeeping.repository';
import { READINESS_LABEL, recordRoomEvent } from './room-events';

const OPEN_STAY_PER_ROOM = 'guest_stays_one_open_per_room_uk';

/** A 23505 raised by the one-open-stay-per-room index, directly or wrapped by drizzle. */
export function isOpenStayCollision(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return inner?.code === '23505' && inner.constraint === OPEN_STAY_PER_ROOM;
}

/** A 23505 raised by a repeated stay reference: draw another and try again. */
function isStayReferenceCollision(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return inner?.code === '23505' && inner.constraint === STAY_REFERENCE_INDEX;
}

/** A room plus the two statuses that are never the same question. */
export interface RoomRow {
  id: string;
  workspaceId: string;
  /** Needed by check in, which opens the guest's folio against the property. */
  propertyId: string;
  label: string | null;
  roomTypeId: string;
  roomTypeName: string;
  /**
   * False once the room's type is archived. Its rooms keep their own status,
   * so without this an archived type's rooms still read as available and the
   * desk could put a guest in a room the host took off sale.
   */
  roomTypeActive: boolean;
  status: 'available' | 'maintenance' | 'out_of_service';
  housekeeping: HousekeepingStatus;
}

/** The open stay in a room, if anyone is in it. */
export interface OccupancyRow {
  roomId: string;
  stayId: string;
  guestName: string | null;
}

/** Enough of a booking to decide whether it can be checked in. */
export interface CheckInSubject {
  id: string;
  workspaceId: string;
  /** Through the room type: the branch this reservation belongs to (ADR-054). */
  propertyId: string | null;
  status: string;
  guestUserId: string | null;
  /** The booking's own reference, written on the prepayment line. */
  reference: string;
  checkIn: string;
  checkOut: string;
  lockedNightlyRateRwf: number | null;
  /** Whether the guest's online payment is still held (or already paid out). Null when none was taken. */
  paymentStatus: string | null;
  /** What has already gone back to the guest, which the prepayment line nets off. */
  refundRwf: number | null;
  /**
   * The room money paid, once a desk change has recorded it (0120): the prepayment line credits this,
   * because after a change the nightly charge times the nights is the new price, not what was paid.
   */
  paidRoomRwf?: number | null;
  /**
   * The property's checkout hour (`HH:MM:SS`), which the stay's planned exit
   * is set to. Optional so a caller that never needed it still type checks.
   */
  checkOutTime?: string | null;
}

export interface StayRow {
  id: string;
  workspaceId: string;
  bookingId: string | null;
  guestUserId: string | null;
  roomId: string;
  /** From the room, so checkout can enqueue a clean without a second read. */
  propertyId: string | null;
  roomLabel: string | null;
  guestName: string | null;
  lifecycle: 'open' | 'closed';
  entryAt: Date;
  plannedExitAt: Date | null;
  actualExitAt: Date | null;
}

/**
 * The only place that touches Drizzle for front desk rooms and stays
 * (ADR-012, build plan step 4).
 *
 * Every read here is workspace scoped in its `where`, and every command reads
 * its subject WITHOUT a workspace filter so the caller can hand the row to
 * `assertOwned` and get a 404 rather than a 403. That split is deliberate and
 * it is the same one `BookingRepository` makes: a list is filtered, a single
 * row is proved.
 */
@Injectable()
export class FrontDeskRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Rooms ---------------------------------------------------------------

  async listRooms(workspaceId: string, scope: BranchScope): Promise<RoomRow[]> {
    const rows = await this.db
      .select({
        id: rooms.id,
        workspaceId: rooms.workspaceId,
        propertyId: rooms.propertyId,
        label: rooms.label,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
        roomTypeStatus: roomTypes.status,
        status: rooms.status,
        housekeeping: rooms.housekeepingStatus,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
      .where(and(eq(rooms.workspaceId, workspaceId), inBranchScope(rooms.propertyId, scope)))
      .orderBy(rooms.label);
    return rows.map(({ roomTypeStatus, ...room }) => ({
      ...room,
      roomTypeActive: roomTypeStatus === 'active',
    }));
  }

  /**
   * Who is currently in each of these rooms.
   *
   * A second query rather than a join on the room list, for the same reason the
   * reservations read splits: a room could carry more than one stay row and a
   * join would then return the room twice. One row per room is the whole point
   * of a room grid.
   */
  async occupancyFor(roomIds: string[]): Promise<Map<string, OccupancyRow>> {
    const found = new Map<string, OccupancyRow>();
    if (roomIds.length === 0) return found;

    const stays = await this.db
      .select({
        roomId: guestStays.roomId,
        stayId: guestStays.id,
        guestName: sql<string | null>`coalesce(${accountName}, nullif(btrim(${guestStays.guestName}), ''), (SELECT nullif(btrim(si.full_name), '') FROM stay_identities si WHERE si.guest_stay_id = ${guestStays.id}))`,
        entryAt: guestStays.entryAt,
      })
      .from(guestStays)
      .leftJoin(users, eq(users.id, guestStays.guestUserId))
      .where(
        and(
          inArray(guestStays.roomId, roomIds),
          eq(guestStays.lifecycle, 'open'),
        ),
      )
      .orderBy(desc(guestStays.entryAt));

    for (const row of stays) {
      if (found.has(row.roomId)) continue;
      found.set(row.roomId, {
        roomId: row.roomId,
        stayId: row.stayId,
        guestName: row.guestName,
      });
    }
    return found;
  }

  async findRoom(roomId: string): Promise<RoomRow | null> {
    const [row] = await this.db
      .select({
        id: rooms.id,
        workspaceId: rooms.workspaceId,
        propertyId: rooms.propertyId,
        label: rooms.label,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
        roomTypeStatus: roomTypes.status,
        status: rooms.status,
        housekeeping: rooms.housekeepingStatus,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!row) return null;
    const { roomTypeStatus, ...room } = row;
    return { ...room, roomTypeActive: roomTypeStatus === 'active' };
  }

  /**
   * Set a room's housekeeping state, and record who said so and when.
   *
   * `status` is untouched on purpose. Inventory and readiness are two owners,
   * and a housekeeper marking a room clean must not be able to put an out of
   * service room back on sale.
   */
  async setHousekeeping(
    roomId: string,
    housekeeping: HousekeepingStatus,
    byUserId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [before] = await tx
        .select({
          status: rooms.housekeepingStatus,
          workspaceId: rooms.workspaceId,
          propertyId: rooms.propertyId,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .for('update');
      await tx
        .update(rooms)
        .set({
          housekeepingStatus: housekeeping,
          housekeepingUpdatedAt: new Date(),
          housekeepingUpdatedByUserId: byUserId,
        })
        .where(eq(rooms.id, roomId));
      // The room's history (real-data 1.2.3): every readiness change says who and when.
      if (before && before.status !== housekeeping) {
        await recordRoomEvent(tx, {
          workspaceId: before.workspaceId,
          propertyId: before.propertyId,
          roomId,
          kind: 'housekeeping',
          fromValue: before.status,
          toValue: housekeeping,
          summary: `${READINESS_LABEL[before.status] ?? before.status} → ${READINESS_LABEL[housekeeping] ?? housekeeping}`,
          actorUserId: byUserId,
        });
      }
    });
  }

  /**
   * The nightly price a room type sells at by default: its default, active
   * rate plan's base price. Null when the type has no such plan or no price.
   *
   * Read by a walk in that arrives with no rate agreed. The night audit bills a
   * walk in from the stay's own price, so a stay opened without one would be a
   * room nobody is ever charged for.
   */
  async defaultNightlyRate(roomTypeId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ price: ratePlans.basePriceRwf })
      .from(ratePlans)
      .where(
        and(
          eq(ratePlans.roomTypeId, roomTypeId),
          eq(ratePlans.isDefault, true),
          eq(ratePlans.status, 'active'),
        ),
      )
      .limit(1);
    return row?.price ?? null;
  }

  // --- Stays ---------------------------------------------------------------

  async findCheckInSubject(bookingId: string): Promise<CheckInSubject | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        workspaceId: bookings.workspaceId,
        propertyId: roomTypes.propertyId,
        status: bookings.status,
        guestUserId: bookings.guestUserId,
        reference: bookings.reference,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
        paymentStatus: bookings.paymentStatus,
        refundRwf: bookings.refundRwf,
        paidRoomRwf: bookings.paidRoomRwf,
        checkOutTime: properties.checkOutTime,
      })
      .from(bookings)
      .leftJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .leftJoin(properties, eq(properties.id, roomTypes.propertyId))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    return row ?? null;
  }

  /** Is there already an open stay for this booking? */
  async openStayForBooking(bookingId: string): Promise<StayRow | null> {
    const [row] = await this.findStays(
      and(
        eq(guestStays.bookingId, bookingId),
        eq(guestStays.lifecycle, 'open'),
      ) as SQL,
    );
    return row ?? null;
  }

  /**
   * Every stay in this workspace, newest arrival first.
   *
   * Scoped in the QUERY rather than checked afterwards, unlike `findStay`
   * below: a list has no single subject to hand to `assertOwned`, so the
   * workspace has to be part of the read or a caller would see another
   * property's guests.
   *
   * Closed stays are included. A guest disputing a charge three nights after
   * checking out is the case the record page exists for.
   */
  async listStays(workspaceId: string, scope: BranchScope): Promise<StayRow[]> {
    // Through the room, never the booking: a walk in has none (ADR-054).
    return this.findStays(
      and(eq(guestStays.workspaceId, workspaceId), inBranchScope(rooms.propertyId, scope)) as SQL,
    );
  }

  async findStay(stayId: string): Promise<StayRow | null> {
    const [row] = await this.findStays(eq(guestStays.id, stayId));
    return row ?? null;
  }

  /**
   * Start a stay, in ONE transaction with the room going out of service for
   * housekeeping purposes.
   *
   * The room is claimed with a guarded update: it only takes if no other open
   * stay grabbed it first. Two receptionists checking two guests into the same
   * room is a real thing that happens at a busy desk, and the second one must
   * lose rather than both succeed.
   */
  async openStay(input: {
    /**
     * NULL for a walk in (ADR-035). `guest_stays.booking_id` is nullable
     * precisely so a stay can exist without one, and that null is how every
     * reader already tells a walk in from a reservation — the app does not
     * carry a separate flag.
     */
    bookingId: string | null;
    workspaceId: string;
    guestUserId: string | null;
    /**
     * Set only when there is no account to read the name from, which is what a
     * walk in means. NULL when `guestUserId` is set: the account is the better
     * source and stays current when the person renames themselves.
     */
    guestName: string | null;
    roomId: string;
    /** NULL for an open ended walk in, which often does not know yet. */
    plannedExitAt: Date | null;
    priceRwf: number | null;
  }): Promise<string | null> {
    // A repeated reference is a draw that collided, not a refusal: draw again,
    // a bounded number of times (one in a billion per draw).
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.insertOpenStay({ ...input, reference: makeStayReference() });
      } catch (error) {
        // The re-check below locks open stays, and a free room has none to lock,
        // so two desks can both pass it. The partial unique index
        // `guest_stays_one_open_per_room_uk` is what actually refuses the second
        // insert; it answers exactly as the re-check does, with null.
        if (isOpenStayCollision(error)) return null;
        if (attempt < 3 && isStayReferenceCollision(error)) continue;
        throw error;
      }
    }
  }

  private insertOpenStay(
    input: Parameters<FrontDeskRepository['openStay']>[0] & { reference: string },
  ): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      // Re-check occupancy INSIDE the transaction. Checking outside it proves
      // only that the room was free a moment ago.
      const taken = await tx
        .select({ id: guestStays.id })
        .from(guestStays)
        .where(
          and(
            eq(guestStays.roomId, input.roomId),
            eq(guestStays.lifecycle, 'open'),
          ),
        )
        .for('update')
        .limit(1);
      if (taken.length > 0) return null;

      const [created] = await tx
        .insert(guestStays)
        .values({
          bookingId: input.bookingId,
          guestUserId: input.guestUserId,
          guestName: input.guestName,
          roomId: input.roomId,
          workspaceId: input.workspaceId,
          checkInMode: 'staffed',
          isVerified: false,
          entryAt: new Date(),
          plannedExitAt: input.plannedExitAt,
          priceRwf: input.priceRwf,
          lifecycle: 'open',
          reference: input.reference,
        })
        .returning({ id: guestStays.id });

      return created?.id ?? null;
    });
  }

  /**
   * Close a stay and dirty its room, in ONE transaction.
   *
   * Two writes that must not come apart: a checkout that did not dirty the room
   * is how housekeeping walks past a room that needs them, and splitting them
   * across two calls means a crash between the two loses the second.
   *
   * Guarded on `open`, so a second checkout returns null rather than moving the
   * exit time of a stay that already ended.
   */
  async closeStay(input: {
    stayId: string;
    roomId: string;
    workspaceId: string;
    propertyId: string | null;
    /**
     * What the desk wrote down on the way out, or undefined for nothing.
     *
     * It is set in the SAME statement that closes the stay, and only when the
     * guard matched. Writing it separately would let a note land on a stay this
     * call did not close — which is precisely the second-press case below.
     */
    departureNote?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(guestStays)
        .set({
          lifecycle: 'closed',
          actualExitAt: new Date(),
          // Absent rather than null when nothing was typed, so a check out with
          // no note never erases one. Nothing writes this twice today, but the
          // column is the kind that grows a second writer.
          ...(input.departureNote === undefined
            ? {}
            : { departureNote: input.departureNote }),
        })
        .where(
          and(eq(guestStays.id, input.stayId), eq(guestStays.lifecycle, 'open')),
        )
        .returning({ id: guestStays.id });

      if (!updated) return false;

      await tx
        .update(rooms)
        .set({ housekeepingStatus: 'dirty', housekeepingUpdatedAt: new Date() })
        .where(eq(rooms.id, input.roomId));

      // ADR-016 slice 5. The clean goes on the board in the SAME transaction
      // that dirties the room. Two calls mean a dropped connection between them
      // loses the second, and the room is then dirty with nobody told.
      if (input.propertyId) {
        await enqueueCheckoutClean(tx, {
          roomId: input.roomId,
          propertyId: input.propertyId,
          workspaceId: input.workspaceId,
          guestStayId: input.stayId,
        });
      }

      return true;
    });
  }

  /**
   * The one stay projection, so every read of a stay returns the same shape.
   *
   * Runs the query and returns rows rather than handing back a half built
   * query, which would have a Drizzle type nobody can write down and would let
   * a caller quietly bolt on a second `where` that overwrote this one.
   */
  private async findStays(where: SQL): Promise<StayRow[]> {
    return this.db
      .select({
        id: guestStays.id,
        workspaceId: guestStays.workspaceId,
        bookingId: guestStays.bookingId,
        guestUserId: guestStays.guestUserId,
        roomId: guestStays.roomId,
        propertyId: rooms.propertyId,
        roomLabel: rooms.label,
        guestName: sql<string | null>`coalesce(${accountName}, nullif(btrim(${guestStays.guestName}), ''), (SELECT nullif(btrim(si.full_name), '') FROM stay_identities si WHERE si.guest_stay_id = ${guestStays.id}))`,
        lifecycle: guestStays.lifecycle,
        entryAt: guestStays.entryAt,
        plannedExitAt: guestStays.plannedExitAt,
        actualExitAt: guestStays.actualExitAt,
      })
      .from(guestStays)
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(users, eq(users.id, guestStays.guestUserId))
      .where(where)
      .orderBy(desc(guestStays.entryAt));
  }
}
