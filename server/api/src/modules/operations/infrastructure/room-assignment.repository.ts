import type { RoomAssignmentStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  roomAssignments,
  rooms,
  roomTypes,
} from '../../../database/drizzle/schema';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface AssignmentRow {
  id: string;
  workspaceId: string;
  /** The held room's branch (ADR-054). */
  propertyId: string;
  bookingId: string;
  roomId: string;
  roomLabel: string | null;
  roomTypeId: string;
  from: string;
  to: string;
  status: RoomAssignmentStatus;
  assignedByUserId: string | null;
  releasedAt: Date | null;
}

export interface AssignmentSubject {
  id: string;
  workspaceId: string;
  /** Through the room type: the reservation's branch (ADR-054). */
  propertyId: string | null;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

/** Postgres raises this when an exclusion constraint refuses a row. */
const EXCLUSION_VIOLATION = '23P01';

/**
 * True for an overlapping hold refused by `room_assignments_no_overlap`, raised directly or wrapped.
 *
 * Drizzle wraps the driver's error ("Failed query: ...") and keeps the Postgres one as its `cause`, so
 * reading only the top-level `code` missed every real refusal and the desk got a 500 for "that room
 * is already held" (found wiring the front desk, interface real-data).
 */
export function isOverlapRefusal(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown } | null;
  if (typeof e !== 'object' || e === null) return false;
  if (e.code === EXCLUSION_VIOLATION) return true;
  const inner = e.cause as { code?: string } | null | undefined;
  return typeof inner === 'object' && inner !== null && inner.code === EXCLUSION_VIOLATION;
}

/**
 * The only place that touches Drizzle for room assignments
 * (ADR-016 slice 4, D-g).
 *
 * `occupies` is a Postgres `daterange` and every read unpacks it into two plain
 * dates, because a range is a good column and a bad wire format. Writes build
 * it with an explicit `'[)'` bound: half open, so a departure on the morning of
 * the 5th does not collide with an arrival that afternoon.
 */
@Injectable()
export class RoomAssignmentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForBooking(bookingId: string): Promise<AssignmentRow[]> {
    return this.select(eq(roomAssignments.bookingId, bookingId));
  }

  /**
   * Every live hold in this workspace that touches `[from, to)`.
   *
   * `&&` is range overlap, the same family of operator the exclusion
   * constraint uses, so the grid and the constraint agree about which holds
   * collide. Released holds are left out: they are history, not occupancy.
   */
  async listAssignedInWindow(
    workspaceId: string,
    scope: BranchScope,
    from: string,
    to: string,
  ): Promise<AssignmentRow[]> {
    return this.select(
      and(
        eq(roomAssignments.workspaceId, workspaceId),
        // The held room's type is the booking's, so its branch is the booking's.
        inBranchScope(rooms.propertyId, scope),
        eq(roomAssignments.status, 'assigned'),
        sql`${roomAssignments.occupies} && daterange(${from}::date, ${to}::date, '[)')`,
      )!,
    );
  }

  /**
   * Live holds on ONE room that touch `[from, to)`, earliest first.
   *
   * What a walk in asks before it takes a room. The exclusion constraint only
   * compares holds with holds, and a walk in is a stay with no hold at all, so
   * nothing in the database stops the desk selling tonight's arrival's room to
   * whoever walks in first.
   */
  async assignedOnRoomInWindow(
    roomId: string,
    from: string,
    to: string,
  ): Promise<AssignmentRow[]> {
    return this.select(
      and(
        eq(roomAssignments.roomId, roomId),
        eq(roomAssignments.status, 'assigned'),
        sql`${roomAssignments.occupies} && daterange(${from}::date, ${to}::date, '[)')`,
      )!,
    );
  }

  async find(id: string): Promise<AssignmentRow | null> {
    const [row] = await this.select(eq(roomAssignments.id, id));
    return row ?? null;
  }

  /**
   * The room this booking holds on a given day (AC-7).
   *
   * `@>` asks whether the range contains the date, which is the same operator
   * the exclusion constraint compares with, so check in and the constraint can
   * never disagree about what "held today" means.
   */
  async assignedOn(
    bookingId: string,
    onDate: string,
  ): Promise<AssignmentRow | null> {
    const [row] = await this.select(
      and(
        eq(roomAssignments.bookingId, bookingId),
        eq(roomAssignments.status, 'assigned'),
        sql`${roomAssignments.occupies} @> ${onDate}::date`,
      )!,
    );
    return row ?? null;
  }

  async findBooking(bookingId: string): Promise<AssignmentSubject | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        workspaceId: bookings.workspaceId,
        propertyId: roomTypes.propertyId,
        roomTypeId: bookings.roomTypeId,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        status: bookings.status,
      })
      .from(bookings)
      .leftJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row ?? null;
  }

  async findRoom(roomId: string): Promise<{
    id: string;
    workspaceId: string;
    propertyId: string;
    roomTypeId: string;
    label: string | null;
    status: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: rooms.id,
        workspaceId: rooms.workspaceId,
        propertyId: rooms.propertyId,
        roomTypeId: rooms.roomTypeId,
        label: rooms.label,
        status: rooms.status,
      })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Hold a room. Throws the database's own refusal on an overlap (AC-6).
   *
   * Nothing here checks for a clash first, on purpose. A read then a write is a
   * race, and the exclusion constraint is a refusal that two concurrent inserts
   * cannot both pass.
   */
  async assign(input: {
    bookingId: string;
    roomId: string;
    workspaceId: string;
    from: string;
    to: string;
    assignedByUserId: string | null;
  }): Promise<string | null> {
    const [row] = await this.db
      .insert(roomAssignments)
      .values({
        bookingId: input.bookingId,
        roomId: input.roomId,
        workspaceId: input.workspaceId,
        occupies: sql`daterange(${input.from}::date, ${input.to}::date, '[)')`,
        assignedByUserId: input.assignedByUserId,
      })
      .returning({ id: roomAssignments.id });
    return row?.id ?? null;
  }

  /** Terminal. A move writes a new row rather than reopening this one. */
  async release(id: string): Promise<boolean> {
    const rows = await this.db
      .update(roomAssignments)
      .set({
        status: 'released',
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(roomAssignments.id, id), eq(roomAssignments.status, 'assigned')),
      )
      .returning({ id: roomAssignments.id });
    return rows.length > 0;
  }

  /**
   * Release every leg a booking still holds. Called at checkout (D-h).
   *
   * At CHECKOUT and not at check in. Releasing at check in looked tidy and
   * defeated the split stay the table exists for: the moment the guest walks
   * into 101, the second leg in 205 would stop being held.
   */
  async releaseForBooking(bookingId: string): Promise<void> {
    await this.db
      .update(roomAssignments)
      .set({
        status: 'released',
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roomAssignments.bookingId, bookingId),
          eq(roomAssignments.status, 'assigned'),
        ),
      );
  }

  private select(where: SQL): Promise<AssignmentRow[]> {
    return this.db
      .select({
        id: roomAssignments.id,
        workspaceId: roomAssignments.workspaceId,
        propertyId: rooms.propertyId,
        bookingId: roomAssignments.bookingId,
        roomId: roomAssignments.roomId,
        roomLabel: rooms.label,
        roomTypeId: rooms.roomTypeId,
        from: sql<string>`lower(${roomAssignments.occupies})::text`,
        to: sql<string>`upper(${roomAssignments.occupies})::text`,
        status: roomAssignments.status,
        assignedByUserId: roomAssignments.assignedByUserId,
        releasedAt: roomAssignments.releasedAt,
      })
      .from(roomAssignments)
      .innerJoin(rooms, eq(rooms.id, roomAssignments.roomId))
      .where(where)
      .orderBy(asc(sql`lower(${roomAssignments.occupies})`));
  }
}
