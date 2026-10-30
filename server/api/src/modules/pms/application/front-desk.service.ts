import type {
  CheckInRequest,
  CheckOutRequest,
  OperatorRoom,
  OperatorStay,
  OperatorStayList,
  SetHousekeepingRequest,
  WalkInRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { plannedExitFor } from '../domain/stay-reference';
import { FolioRepository } from '../infrastructure/folio.repository';
import { FolioService } from './folio.service';
import {
  type CheckInSubject,
  type RoomRow,
  type StayRow,
  FrontDeskRepository,
} from '../infrastructure/front-desk.repository';
import { RoomAssignmentService } from './room-assignment.service';
import { SelfCheckInService } from './self-check-in.service';
import { StayClaimService } from './stay-claim.service';

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
  private readonly log = new Logger(FrontDeskService.name);

  constructor(
    private readonly rooms: FrontDeskRepository,
    private readonly assignments: RoomAssignmentService,
    private readonly folios: FolioRepository,
    private readonly bills: FolioService,
    /**
     * §6.8. The registration card, the claim code and the mail that carries it.
     * Injected rather than inlined so that the one rule that matters — none of
     * it may fail a check in — lives in one place with the reason written down.
     */
    private readonly onboarding: StayClaimService,
    /** The identity a guest sent ahead of arrival, carried onto the stay (ADR-060). */
    private readonly selfCheckIn: SelfCheckInService,
  ) {}

  /** Every room in this workspace, with who is in it. */
  async listRooms(ws: ScopedWorkspace): Promise<OperatorRoom[]> {
    const rows = await this.rooms.listRooms(ws.workspaceId, ws.branchScope);
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
    ws: ScopedWorkspace,
    roomId: string,
    body: SetHousekeepingRequest,
    byUserId: string,
  ): Promise<OperatorRoom> {
    const room = assertOwned(await this.rooms.findRoom(roomId), ws);
    assertInBranchScope(ws, room.propertyId);
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
    ws: ScopedWorkspace,
    bookingId: string,
    body: CheckInRequest,
  ): Promise<OperatorStay> {
    const booking = assertOwned(
      await this.rooms.findCheckInSubject(bookingId),
      ws,
    );
    // A booking of another branch reads as absent (ADR-054 AC-T2).
    assertInBranchScope(ws, booking.propertyId);
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
    assertInBranchScope(ws, room.propertyId);
    // The guest booked THIS property. Owning both branches is not enough: a
    // room at another branch put the stay, its bill and its sale on a property
    // the guest never booked, and nothing downstream could tell.
    if (room.propertyId !== booking.propertyId) {
      throw new BadRequestException(
        `Room ${room.label ?? ''} is at another branch. This guest booked a room at a different property.`.replace(/\s+/g, ' '),
      );
    }
    assertRoomTypeOnSale(room);
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
      // checkout hour, on the Kigali clock. Read from the booking rather than
      // asked for, so the desk cannot shorten a stay the guest already paid for
      // by mistyping. (It was `T11:00:00Z`, which is 13:00 in Kigali.)
      plannedExitAt: plannedExitFor(booking.checkOut, booking.checkOutTime),
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
    if (folioId) {
      await this.folios.bindToStay(folioId, created.id);
      await this.creditPrepayment(folioId, ws.workspaceId, booking);
    }

    // §6.8. Last, and never able to fail the check in: the registration card,
    // the claim code and the "continue in the app" mail. A booked guest usually
    // sends nothing here and nothing happens.
    await this.onboarding.registerAndInvite(created.id, body.guest);
    // What the guest sent from their phone before arriving, photo included.
    // After the desk card, so anything the desk typed wins; never throws.
    await this.selfCheckIn.carryToStay(booking.id, created.id);

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
  async walkIn(ws: ScopedWorkspace, body: WalkInRequest): Promise<OperatorStay> {
    const room = assertOwned(await this.rooms.findRoom(body.roomId), ws);
    assertInBranchScope(ws, room.propertyId);
    assertRoomTypeOnSale(room);
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
    const now = new Date();
    if (plannedExitAt && plannedExitAt.getTime() <= now.getTime()) {
      throw new BadRequestException('The departure has to be after now.');
    }

    const roomName = room.label ? `Room ${room.label}` : 'That room';

    /*
     * A ROOM HELD FOR A GUEST WHO IS COMING IS NOT FREE (ADR-016 D-g).
     *
     * The exclusion constraint compares holds with holds, and a walk in has no
     * hold, so nothing refused this: the desk could sell tonight's arrival's
     * room to whoever walked in first, and that guest was then turned away at
     * check in with a 409 nobody at the counter could fix. An open ended walk
     * in is asked about tonight only, which is all the desk is promising.
     */
    const today = now.toISOString().slice(0, 10);
    const lastNight = plannedExitAt
      ? plannedExitAt.toISOString().slice(0, 10)
      : today;
    const until = lastNight > today ? lastNight : this.dayAfter(today);
    const hold = await this.assignments.firstHoldOnRoom(room.id, today, until);
    if (hold) {
      throw new ConflictException(
        `${roomName} is held for a reservation arriving ${hold.from}. Choose another room, or move that reservation first.`,
      );
    }

    /*
     * THE RATE IS WHAT GETS THE ROOM PAID FOR. The night audit bills a walk in
     * from the stay's price, so a stay opened without one is a room nobody is
     * ever charged for — and check out then closed its zero bill on its own.
     * Absent means the room type's default rate; a type with no priced default
     * plan leaves the desk to say the figure out loud.
     */
    const priceRwf =
      body.nightlyRateRwf ??
      (await this.rooms.defaultNightlyRate(room.roomTypeId));
    if (!priceRwf) {
      throw new BadRequestException(
        `${room.roomTypeName} has no default rate. Enter the nightly rate agreed with the guest.`,
      );
    }

    const stayId = await this.rooms.openStay({
      bookingId: null,
      workspaceId: ws.workspaceId,
      // No account, which is what a walk in means. The name goes on the stay.
      guestUserId: null,
      guestName: body.guestName.trim(),
      roomId: room.id,
      plannedExitAt,
      priceRwf,
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

    /*
     * §6.8, AND THIS IS THE CASE IT WAS BUILT FOR.
     *
     * A walk in has no account, so what the desk types here is the ONLY record
     * of who is sleeping in the building, and the claim code this mails is the
     * only way that person ever reaches the app. Without it a walk in stays a
     * room number and a first name for the whole of their stay: they cannot
     * message a department, order to the room, read their own bill or raise a
     * problem, because every one of those resolves ownership from a
     * `guest_user_id` that nothing would ever set.
     *
     * It still cannot fail the check in. The stay and the bill are written; the
     * invitation is best effort and the desk can send it again.
     */
    await this.onboarding.registerAndInvite(created.id, body.guest);

    return this.presentStay(created);
  }

  /**
   * Close an open stay and dirty its room, in one transaction.
   *
   * Guarded on the stay still being open, so a double click answers with the
   * stay as it already stands rather than moving an exit time that was already
   * recorded.
   */
  async checkOut(
    ws: ScopedWorkspace,
    stayId: string,
    body: CheckOutRequest = {},
  ): Promise<OperatorStay> {
    const stay = assertOwned(await this.rooms.findStay(stayId), ws);
    // Through the room, never the booking: a walk in has none (ADR-054).
    assertInBranchScope(ws, stay.propertyId);
    if (stay.lifecycle === 'closed') return this.presentStay(stay);

    const closed = await this.rooms.closeStay({
      stayId: stay.id,
      roomId: stay.roomId,
      workspaceId: ws.workspaceId,
      propertyId: stay.propertyId,
      // Written by the SAME guarded statement that closes the stay, so a note
      // can never land on a stay somebody else closed first (the `!closed`
      // branch below is that race, and it must stay a read).
      departureNote: body.note,
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

    await this.settleOnDeparture(ws, stay.id);

    const updated = await this.rooms.findStay(stayId);
    if (!updated) throw this.vanished();
    return this.presentStay(updated);
  }

  /**
   * CHECK OUT IS WHAT SIGNS (ADR-050 D-a, D-b, AC-4).
   *
   * Once the stay has closed, a bill that is settled to zero is closed too,
   * which raises its one `NS`. Three rules shape this and none is negotiable:
   *
   * - **It runs AFTER the stay closes.** The guest leaving, the room going
   *   dirty and the cleaning task are the desk's facts, and nothing fiscal is
   *   allowed to be what un-checks-out a guest.
   * - **It never throws.** A VSDC outage, a missing EBM connection, a line
   *   nobody declared: each leaves the bill for a person on the Bills screen
   *   and is logged, and the check out still answers 200. The `no_connection`
   *   case does not even reach here as a failure; the close writes it itself.
   * - **A bill still owing money is left open.** Nothing in this slice says
   *   check out refuses a balance, so it does not start now. The bill stays on
   *   the Bills list, and closing it there signs it.
   */
  private async settleOnDeparture(ws: ScopedWorkspace, stayId: string): Promise<void> {
    try {
      const folio = await this.folios.findFolioForStay(stayId);
      if (!folio || folio.status === 'closed' || folio.balanceRwf !== 0) return;
      await this.bills.close(ws, folio.id);
    } catch (error) {
      this.log.error(
        `Stay ${stayId} checked out, but its bill was not signed; it waits on the Bills screen: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Put the guest's online prepayment on their bill (Option A, 2026-10-08).
   *
   * THE BUG THIS CLOSES. A booked guest pays online and the money is held in
   * escrow, but the bill got no line for it: the night audit then posted each
   * night's room charge and the bill read as owing the whole room. The desk
   * was shown "Take a payment" for a stay already paid for, and the escrow was
   * still paid out to the host, so the room could be collected twice.
   *
   * The line is a `deposit` against `ESCROW_RECEIVABLE`, not a cash account:
   * the host has not received this money, the platform holds it and owes it
   * at payout. Its RRA means of payment is mobile money, which is how every
   * online booking is paid (MTN MoMo or Airtel Money; card is not open).
   *
   * The amount is the ROOM, not the guest's whole payment: the locked nightly
   * rate times the nights, which is exactly what the night audit will post,
   * less anything already refunded. Injishi's guest service fee is Injishi's
   * and never belongs on the host's bill.
   *
   * Idempotent by key, so a retried check in cannot credit the room twice. It
   * never fails the check in: the guest is at the desk and the stay is open, so
   * a failure here is logged for the Bills screen rather than thrown.
   */
  private async creditPrepayment(
    folioId: string,
    workspaceId: string,
    booking: CheckInSubject,
  ): Promise<void> {
    const prepaid = prepaidRoomRwf(booking);
    if (prepaid <= 0) return;
    const idempotencyKey = `escrow-prepaid:${booking.id}`;
    try {
      if (await this.folios.findChargeByIdempotencyKey(idempotencyKey)) return;
      await this.folios.postCharges({
        folioId,
        workspaceId,
        drafts: [
          {
            chargeType: 'deposit',
            description: `Paid online, held in escrow (${booking.reference})`,
            departmentId: null,
            quantity: 1,
            unitPriceRwf: -prepaid,
            amountRwf: -prepaid,
            taxCode: null,
            taxRate: null,
            taxAmountRwf: null,
            sourceRefType: 'booking',
            sourceRefId: booking.id,
            postedByUserId: null,
            businessDate: null,
            idempotencyKey,
            accountCode: ESCROW_RECEIVABLE,
            method: 'mobile_money',
          },
        ],
      });
    } catch (error) {
      this.log.error(
        `Booking ${booking.reference} checked in, but its online prepayment was not put on bill ${folioId}; ` +
          'the bill will read as owing until it is: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** `2026-09-15` to `2026-09-16`, in UTC like every business date here. */
  private dayAfter(isoDate: string): string {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  private presentRoom(row: RoomRow): Omit<OperatorRoom, 'occupiedBy'> {
    return {
      id: row.id,
      label: row.label,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      roomTypeActive: row.roomTypeActive,
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
  async listStays(ws: ScopedWorkspace): Promise<OperatorStayList> {
    const rows = await this.rooms.listStays(ws.workspaceId, ws.branchScope);
    return { stays: rows.map((row) => this.presentStay(row)) };
  }

  /**
   * ONE stay, by its own id.
   *
   * The record screen used to find its stay inside `listStays` above, which is
   * the same mistake the reservation record made: a LIST is the wrong oracle
   * for "does this record exist". `listStays` is unwindowed today, so this
   * closes the edge before a window is ever added to it rather than after —
   * and it stops the screen paying for every stay on the property to render
   * one.
   *
   * Scoped exactly as `checkOut` scopes its stay: `assertOwned` for the
   * workspace, `assertInBranchScope` through the ROOM's property for the
   * branch. Through the room, never the booking, because a walk in has none
   * (ADR-054).
   */
  async getStay(ws: ScopedWorkspace, stayId: string): Promise<OperatorStay> {
    const stay = assertOwned(await this.rooms.findStay(stayId), ws);
    assertInBranchScope(ws, stay.propertyId);
    return this.presentStay(stay);
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

/** A room whose type the host archived is off sale, whatever its own status says. */
function assertRoomTypeOnSale(room: Pick<RoomRow, 'label' | 'roomTypeName' | 'roomTypeActive'>): void {
  if (!room.roomTypeActive) {
    throw new ConflictException(
      `Room ${room.label ?? ''} belongs to ${room.roomTypeName}, which is archived. Restore the room type or pick another room.`.replace(/\s+/g, ' '),
    );
  }
}

/** The account an online prepayment is held in until payout (migration 0064). */
export const ESCROW_RECEIVABLE = 'ESCROW_RECEIVABLE';

/** Payment states in which the guest's money is held or already paid out. */
const PREPAID_STATUSES = new Set(['captured', 'refunded_partial', 'refund_pending', 'paid_out']);

/**
 * The room the guest already paid for online: the locked nightly rate times
 * the nights, less any refund. Zero when nothing is held (refunded in full,
 * forfeited) or no rate was locked.
 */
export function prepaidRoomRwf(
  booking: Pick<CheckInSubject, 'checkIn' | 'checkOut' | 'lockedNightlyRateRwf' | 'paymentStatus' | 'refundRwf'>,
): number {
  if (!booking.paymentStatus || !PREPAID_STATUSES.has(booking.paymentStatus) || !booking.lockedNightlyRateRwf) return 0;
  const nights = Math.round(
    (Date.parse(`${booking.checkOut}T00:00:00Z`) - Date.parse(`${booking.checkIn}T00:00:00Z`)) / 86_400_000,
  );
  if (nights <= 0) return 0;
  return Math.max(0, booking.lockedNightlyRateRwf * nights - (booking.refundRwf ?? 0));
}
