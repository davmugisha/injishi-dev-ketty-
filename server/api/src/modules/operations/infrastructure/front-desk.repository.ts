import type { HousekeepingStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  guestStays,
  rooms,
  roomTypes,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { enqueueCheckoutClean } from './housekeeping.repository';

/** A room plus the two statuses that are never the same question. */
export interface RoomRow {
  id: string;
  workspaceId: string;
  /** Needed by check in, which opens the guest's folio against the property. */
  propertyId: string;
  label: string | null;
  roomTypeId: string;
  roomTypeName: string;
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
  status: string;
  guestUserId: string | null;
  checkOut: string;
  lockedNightlyRateRwf: number | null;
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

  async listRooms(workspaceId: string): Promise<RoomRow[]> {
    return this.db
      .select({
        id: rooms.id,
        workspaceId: rooms.workspaceId,
        propertyId: rooms.propertyId,
        label: rooms.label,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
        status: rooms.status,
        housekeeping: rooms.housekeepingStatus,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
      .where(eq(rooms.workspaceId, workspaceId))
      .orderBy(rooms.label);
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
        guestName: sql<string | null>`coalesce(${users.name}, ${guestStays.guestName})`,
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
        status: rooms.status,
        housekeeping: rooms.housekeepingStatus,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
      .where(eq(rooms.id, roomId))
      .limit(1);

    return row ?? null;
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
    await this.db
      .update(rooms)
      .set({
        housekeepingStatus: housekeeping,
        housekeepingUpdatedAt: new Date(),
        housekeepingUpdatedByUserId: byUserId,
      })
      .where(eq(rooms.id, roomId));
  }

  // --- Stays ---------------------------------------------------------------

  async findCheckInSubject(bookingId: string): Promise<CheckInSubject | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        workspaceId: bookings.workspaceId,
        status: bookings.status,
        guestUserId: bookings.guestUserId,
        checkOut: bookings.checkOut,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
      })
      .from(bookings)
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
  async listStays(workspaceId: string): Promise<StayRow[]> {
    return this.findStays(eq(guestStays.workspaceId, workspaceId));
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
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(guestStays)
        .set({ lifecycle: 'closed', actualExitAt: new Date() })
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
        guestName: sql<string | null>`coalesce(${users.name}, ${guestStays.guestName})`,
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
