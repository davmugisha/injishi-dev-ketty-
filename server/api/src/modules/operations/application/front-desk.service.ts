import type {
  CheckInRequest,
  OperatorRoom,
  OperatorStay,
  OperatorStayList,
  SetHousekeepingRequest,
  WalkInRequest,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { FolioRepository } from '../infrastructure/folio.repository';
import {
  type RoomRow,
  type StayRow,
  FrontDeskRepository,
} from '../infrastructure/front-desk.repository';
import { RoomAssignmentService } from './room-assignment.service';

/**
 * The hospitality front desk: rooms, check in, check out (ADR-012 step 4).
 *
 * Every command here copies the reservations thread exactly, which is the whole
 * point of that thread having gone first:
 *
 *   1. `WorkspaceGuard` has already proved the caller holds the workspace and
 *      that the workspace may act at all;
 *   2. the service reads its subject unscoped and hands it to `assertOwned`,
 *      so another workspace's id is a 404 and never a 403;
 *   3. the write is guarded on the state it expects, so a race loses rather
 *      than corrupting;
 *   4. the command returns the row as it now stands, so the client patches from
 *      the server's answer rather than from a guess.
 */
@Injectable()
export class FrontDeskService {
  constructor(
    private readonly rooms: FrontDeskRepository,
    private readonly assignments: RoomAssignmentService,
    private readonly folios: FolioRepository,
  ) {}

  /** Every room in this workspace, with who is in it. */
  async listRooms(ws: WorkspaceAccess): Promise<OperatorRoom[]> {
    const rows = await this.rooms.listRooms(ws.workspaceId);
    const occupancy = await this.rooms.occupancyFor(rows.map((r) => r.id));

    return rows.map((row) => {
      const here = occupancy.get(row.id);
      return {
        ...this.presentRoom(row),
        occupiedBy: here
          ? { stayId: here.stayId, guestName: here.guestName }
          : null,
      };
    });
  }

  /**
   * Mark a room clean, dirty, inspected or out of order.
   *
   * Deliberately does NOT touch `rooms.status`. Readiness and sellability have
   * two different owners, and letting housekeeping move inventory is how an out
   * of service room quietly goes back on sale.
   */
  async setHousekeeping(
    ws: WorkspaceAccess,
    roomId: string,
    body: SetHousekeepingRequest,
    byUserId: string,
  ): Promise<OperatorRoom> {
    const room = assertOwned(await this.rooms.findRoom(roomId), ws);
    await this.rooms.setHousekeeping(room.id, body.housekeeping, byUserId);

    const updated = await this.rooms.findRoom(roomId);
    if (!updated) throw this.vanished();
    const occupancy = await this.rooms.occupancyFor([updated.id]);
    const here = occupancy.get(updated.id);
    return {
      ...this.presentRoom(updated),
      occupiedBy: here ? { stayId: here.stayId, guestName: here.guestName } : null,
    };
  }

  /**
   * Check a confirmed reservation in.
   *
   * The path names the BOOKING rather than a stay, because a stay does not
   * exist until someone walks in; this command is what creates it. A walk in
   * has no booking to name and so has no route here at all — it needs its own
   * command, which the ADR's route table does not define.
   *
   * Both the booking and the room are proved to belong to this workspace. The
   * room check is not decoration: without it a caller could check their own
   * guest into a competitor's room, and `WorkspaceGuard` would see nothing
   * wrong because the workspace they named is genuinely theirs.
   */
  async checkIn(
    ws: WorkspaceAccess,
    bookingId: string,
    body: CheckInRequest,
  ): Promise<OperatorStay> {
    const booking = assertOwned(
      await this.rooms.findCheckInSubject(bookingId),
      ws,
    );
    if (booking.status !== 'confirmed') {
      throw new ConflictException(
        booking.status === 'pending_approval'
          ? 'Approve this request before checking the guest in.'
          : 'This reservation is not confirmed, so nobody can check in against it.',
      );
    }

    const existing = await this.rooms.openStayForBooking(bookingId);
    if (existing) {
      // Not an error. The desk clicked twice, or two people did. Answer with
      // the stay that already exists rather than refusing something that has
      // in fact already happened.
      return this.presentStay(existing);
    }

    // ADR-016 D-i and AC-7. The room the guest gets is the one already held
    // for today, and a `roomId` in the body overrides it. The override is what
    // the desk uses when a guest asks to move at the counter; without the
    // assignment, every check in would still be a room chosen from memory.
    const assigned = await this.assignments.roomAssignedToday(booking.id);
    const roomId = body.roomId ?? assigned?.roomId ?? null;
    if (!roomId) {
      throw new BadRequestException(
        'This reservation has no room held for today. Assign one, or name a room in the request.',
      );
    }

    const room = assertOwned(await this.rooms.findRoom(roomId), ws);
    if (room.status !== 'available') {
      throw new ConflictException(
        `Room ${room.label ?? ''} is ${room.status.replace('_', ' ')} and cannot take a guest.`.trim(),
      );
    }

    const stayId = await this.rooms.openStay({
      bookingId: booking.id,
      workspaceId: ws.workspaceId,
      guestUserId: booking.guestUserId,
      // Null: this guest HAS an account, and the account is the better source
      // of the name. The column is for a walk in, which has none.
      guestName: null,
      roomId: room.id,
      // The planned exit is the booking's own checkout date at the property's
      // checkout hour. Read from the booking rather than asked for, so the desk
      // cannot shorten a stay the guest already paid for by mistyping.
      plannedExitAt: new Date(`${booking.checkOut}T11:00:00Z`),
      priceRwf: body.nightlyRateRwf ?? booking.lockedNightlyRateRwf,
    });

    if (!stayId) {
      throw new ConflictException(
        `Room ${room.label ?? ''} was just taken by another check in.`.trim(),
      );
    }

    const created = await this.rooms.findStay(stayId);
    if (!created) throw this.vanished();

    // ADR-016 D-k. The bill opens with the booking and gains the stay here,
    // keeping BOTH ids. §14 asked for "exactly one is set" and for this bind to
    // happen, which cannot both be true, so the check relaxed instead.
    const folioId = await this.folios.openForBooking({
      bookingId: booking.id,
      workspaceId: ws.workspaceId,
      propertyId: room.propertyId,
      guestUserId: booking.guestUserId,
    });
    if (folioId) await this.folios.bindToStay(folioId, created.id);

    return this.presentStay(created);
  }


  /**
   * Check a WALK IN in — somebody at the counter with no booking (ADR-035).
   *
   * **This command did not exist, and its absence was structural.**
   * `POST /ops/stays/:id/checkin` names a BOOKING in its path, so a person who
   * never booked had no route at all: the "New walk-in" button in the app
   * opened a form that could not reach the server.
   *
   * IT REUSES `openStay`, and that is the point of writing it this way rather
   * than as its own insert. The guarded claim inside that transaction — re-read
   * the room FOR UPDATE, refuse if anyone took it — is exactly the race a busy
   * desk creates, and a walk in is MORE exposed to it than a reservation is:
   * nothing held the room in advance.
   *
   * A WALK IN IS A STAY WITH NO BOOKING, not a stay with a flag. The database
   * already says it by leaving `booking_id` null, every reader already reads it
   * that way, and a second place to set the same fact is a second place for it
   * to be wrong.
   *
   * THE FOLIO OPENS HERE TOO. A walk in that got no bill would be a guest
   * nobody could charge, which is most of what a walk in is: somebody who pays
   * at the counter.
   */
  async walkIn(ws: WorkspaceAccess, body: WalkInRequest): Promise<OperatorStay> {
    const room = assertOwned(await this.rooms.findRoom(body.roomId), ws);
    if (room.status !== 'available') {
      throw new ConflictException(
        `Room ${room.label ?? ''} is ${room.status.replace('_', ' ')} and cannot take a guest.`.trim(),
      );
    }

    /*
     * The planned exit is OPTIONAL, unlike an ordinary check in where it is
     * read from the booking. A walk in often does not know how long they are
     * staying, which is half the reason they are one; absent means open ended,
     * and checkout records the real departure either way.
     */
    const plannedExitAt = body.plannedExitAt
      ? new Date(body.plannedExitAt)
      : null;
    if (plannedExitAt && Number.isNaN(plannedExitAt.getTime())) {
      throw new BadRequestException('That departure date is not a real date.');
    }

    const stayId = await this.rooms.openStay({
      bookingId: null,
      workspaceId: ws.workspaceId,
      // No account, which is what a walk in means. The name goes on the stay.
      guestUserId: null,
      guestName: body.guestName.trim(),
      roomId: room.id,
      plannedExitAt,
      priceRwf: body.nightlyRateRwf ?? null,
    });

    if (!stayId) {
      throw new ConflictException(
        `Room ${room.label ?? ''} was just taken by another check in.`.trim(),
      );
    }

    const created = await this.rooms.findStay(stayId);
    if (!created) throw this.vanished();

    if (room.propertyId) {
      await this.folios.openForStay({
        guestStayId: created.id,
        workspaceId: ws.workspaceId,
        propertyId: room.propertyId,
        guestUserId: null,
      });
    }

    return this.presentStay(created);
  }

  /**
   * Close an open stay and dirty its room, in one transaction.
   *
   * Guarded on the stay still being open, so a double click answers with the
   * stay as it already stands rather than moving an exit time that was already
   * recorded.
   */
  async checkOut(ws: WorkspaceAccess, stayId: string): Promise<OperatorStay> {
    const stay = assertOwned(await this.rooms.findStay(stayId), ws);
    if (stay.lifecycle === 'closed') return this.presentStay(stay);

    const closed = await this.rooms.closeStay({
      stayId: stay.id,
      roomId: stay.roomId,
      workspaceId: ws.workspaceId,
      propertyId: stay.propertyId,
    });

    // ADR-016 D-h and AC-8. The hold runs to CHECKOUT, never to check in.
    // Releasing at check in looked tidy and freed a split stay's later legs the
    // moment the guest walked into the first room.
    if (closed && stay.bookingId) {
      await this.assignments.releaseForBooking(stay.bookingId);
    }
    if (!closed) {
      // Somebody else closed it between our read and our write. Their write is
      // as valid as ours would have been, so report where it landed.
      const now = await this.rooms.findStay(stayId);
      if (!now) throw this.vanished();
      return this.presentStay(now);
    }

    const updated = await this.rooms.findStay(stayId);
    if (!updated) throw this.vanished();
    return this.presentStay(updated);
  }

  private presentRoom(row: RoomRow): Omit<OperatorRoom, 'occupiedBy'> {
    return {
      id: row.id,
      label: row.label,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      status: row.status,
      housekeeping: row.housekeeping,
    };
  }

  /**
   * Every stay on this property, open and closed.
   *
   * No permission beyond holding the workspace, matching the reservations
   * and rooms reads: a receptionist has to open a stay to do the job, and
   * the FOLIO behind it is separately gated on `folio.charge` anyway.
   */
  async listStays(ws: WorkspaceAccess): Promise<OperatorStayList> {
    const rows = await this.rooms.listStays(ws.workspaceId);
    return { stays: rows.map((row) => this.presentStay(row)) };
  }

  private presentStay(row: StayRow): OperatorStay {
    return {
      id: row.id,
      bookingId: row.bookingId,
      guestName: row.guestName,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      lifecycle: row.lifecycle,
      entryAt: row.entryAt.toISOString(),
      plannedExitAt: row.plannedExitAt?.toISOString() ?? null,
      actualExitAt: row.actualExitAt?.toISOString() ?? null,
    };
  }

  /**
   * A row that existed a line ago and does not now.
   *
   * A 500, not a 404: the write succeeded, so telling the caller "not found"
   * would be false and would send them looking for a mistake they did not make.
   */
  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
