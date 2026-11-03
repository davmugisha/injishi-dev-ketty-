import { localToday } from '../domain/pricing';
import type {
  AssignRoomRequest,
  OperatorRoomAssignment,
  RoomAssignmentWindowQuery,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import {
  type AssignmentRow,
  type AssignmentSubject,
  isOverlapRefusal,
  RoomAssignmentRepository,
} from '../infrastructure/room-assignment.repository';

/** The widest window the room grid may ask for in one read. */
const MAX_WINDOW_DAYS = 62;

/**
 * Give a booking a physical room before the guest arrives
 * (ADR-016 slice 4, D-g to D-i).
 *
 * A booking names a room TYPE, never a room, which is correct: the guest bought
 * "a Standard Double", not room 101. This is where a type becomes a room, the
 * afternoon before, so check in takes seconds.
 *
 * THE DATABASE DOES THE HARD PART. A GiST exclusion constraint refuses two
 * overlapping holds on one room, so a direct SQL insert is refused exactly as
 * an API call is (AC-6). Nothing here reads first to check: a read then a write
 * is a race, and two concurrent inserts cannot both pass the constraint.
 *
 * Two things the constraint CANNOT check, so this service does: that the room
 * belongs to the booking's workspace, and that the room is of the type the
 * booking bought. A Standard Double assigned to a suite is a pricing bug rather
 * than a scheduling one, and no database rule would ever notice it.
 */
@Injectable()
export class RoomAssignmentService {
  constructor(private readonly assignments: RoomAssignmentRepository) {}

  /** The reservation a route named, in this workspace and a branch in scope (ADR-054 AC-T2). */
  private ownBooking(ws: ScopedWorkspace, row: AssignmentSubject | null): AssignmentSubject {
    const booking = assertOwned(row, ws);
    assertInBranchScope(ws, booking.propertyId);
    return booking;
  }

  async listForBooking(
    ws: ScopedWorkspace,
    bookingId: string,
  ): Promise<OperatorRoomAssignment[]> {
    const booking = this.ownBooking(ws, await this.assignments.findBooking(bookingId));
    const rows = await this.assignments.listForBooking(booking.id);
    return rows.map((row) => this.present(row));
  }

  /**
   * Every live hold across the property over a window (the room grid's read).
   *
   * Capped, because a tape chart is a fortnight or two and an uncapped window
   * is the whole history of the property in one response.
   */
  async listForWindow(
    ws: ScopedWorkspace,
    query: RoomAssignmentWindowQuery,
  ): Promise<OperatorRoomAssignment[]> {
    const span =
      (Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) /
      86_400_000;
    if (!Number.isFinite(span)) {
      throw new UnprocessableEntityException('Those are not calendar dates.');
    }
    if (span > MAX_WINDOW_DAYS) {
      throw new UnprocessableEntityException(
        `A window can span at most ${MAX_WINDOW_DAYS} days.`,
      );
    }
    const rows = await this.assignments.listAssignedInWindow(
      ws.workspaceId,
      ws.branchScope,
      query.from,
      query.to,
    );
    return rows.map((row) => this.present(row));
  }

  async assign(
    ws: ScopedWorkspace,
    bookingId: string,
    body: AssignRoomRequest,
    userId: string,
  ): Promise<OperatorRoomAssignment> {
    const booking = this.ownBooking(ws, await this.assignments.findBooking(bookingId));
    if (booking.status !== 'confirmed' && booking.status !== 'pending_approval') {
      throw new ConflictException(
        'That reservation is not live, so no room can be held for it.',
      );
    }

    const room = assertOwned(await this.assignments.findRoom(body.roomId), ws);
    assertInBranchScope(ws, room.propertyId);
    if (room.roomTypeId !== booking.roomTypeId) {
      throw new UnprocessableEntityException(
        'That room is a different room type than the guest booked.',
      );
    }
    if (room.status !== 'available') {
      throw new ConflictException(
        `Room ${room.label ?? ''} is ${room.status.replace('_', ' ')} and cannot be held.`.trim(),
      );
    }

    // Defaults to the booking's own dates. An explicit range is for a SPLIT
    // STAY, which is the requirement a nullable column on `bookings` could
    // never have met: one column holds one room.
    const from = body.from ?? booking.checkIn;
    const to = body.to ?? booking.checkOut;
    if (from >= to) {
      throw new UnprocessableEntityException(
        'The hold has to end after it starts. A same day range holds nothing.',
      );
    }

    let id: string | null;
    try {
      id = await this.assignments.assign({
        bookingId: booking.id,
        roomId: room.id,
        workspaceId: ws.workspaceId,
        from,
        to,
        assignedByUserId: userId,
      });
    } catch (error) {
      if (isOverlapRefusal(error)) {
        throw new ConflictException(
          `Room ${room.label ?? ''} is already held over those dates.`.trim(),
        );
      }
      throw error;
    }
    if (!id) throw this.vanished();

    const created = await this.assignments.find(id);
    if (!created) throw this.vanished();
    return this.present(created);
  }

  /**
   * Let a room go.
   *
   * The route names the ASSIGNMENT rather than the booking, because a split
   * stay has several and releasing "the booking's room" would be ambiguous.
   */
  async release(
    ws: ScopedWorkspace,
    bookingId: string,
    assignmentId: string,
  ): Promise<OperatorRoomAssignment> {
    const booking = this.ownBooking(ws, await this.assignments.findBooking(bookingId));
    const assignment = assertOwned(await this.assignments.find(assignmentId), ws);
    assertInBranchScope(ws, assignment.propertyId);
    if (assignment.bookingId !== booking.id) {
      throw new ConflictException('That hold is not on this reservation.');
    }

    if (assignment.status === 'assigned') {
      await this.assignments.release(assignment.id);
    }

    const updated = await this.assignments.find(assignmentId);
    if (!updated) throw this.vanished();
    return this.present(updated);
  }

  /** The room a booking holds today, read by check in (AC-7). */
  async roomAssignedToday(bookingId: string): Promise<AssignmentRow | null> {
    const today = localToday();
    return this.assignments.assignedOn(bookingId, today);
  }

  /**
   * The first live hold on a room over `[from, to)`, read by a walk in.
   *
   * A hold names a guest who is coming; putting somebody else in the room
   * turns that guest away at the desk with a 409 the receptionist cannot fix.
   */
  async firstHoldOnRoom(
    roomId: string,
    from: string,
    to: string,
  ): Promise<AssignmentRow | null> {
    const [row] = await this.assignments.assignedOnRoomInWindow(roomId, from, to);
    return row ?? null;
  }

  /** Called at checkout, never at check in (D-h, AC-8). */
  async releaseForBooking(bookingId: string): Promise<void> {
    await this.assignments.releaseForBooking(bookingId);
  }

  private present(row: AssignmentRow): OperatorRoomAssignment {
    return {
      id: row.id,
      bookingId: row.bookingId,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      from: row.from,
      to: row.to,
      status: row.status,
      assignedByUserId: row.assignedByUserId,
      releasedAt: row.releasedAt?.toISOString() ?? null,
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
