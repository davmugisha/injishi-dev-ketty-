import {
  cancellationRefund,
  type BookingChannel,
  type CancellationTier,
  type FrontDeskBoard,
  type FrontDeskBoardQuery,
  type FrontDeskBooking,
  type FrontDeskFolio,
  type FrontDeskRefundQuote,
  type FrontDeskRoom,
  type FrontDeskRoomType,
  type FrontDeskStay,
  type OperatorReservationState,
} from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { noShowRefund } from '../../booking/domain/no-show';
import { localToday, nightsBetween } from '../../booking/domain/pricing';
import {
  type BoardBookingRow,
  type BoardRoomRow,
  type BoardStayRow,
  FrontDeskBoardRepository,
} from '../infrastructure/front-desk-board.repository';

/**
 * The front desk's day, in one read (`GET /api/v1/ops/front-desk`).
 *
 * Today is decided ONCE, here, in Kigali, and every row in the answer is read
 * against it. The desk's screens used to each decide "today" for themselves;
 * two of them disagreeing about whether a guest arrives today is how a room is
 * sold twice.
 *
 * The property is one the caller covers (ADR-054). A named property outside
 * that cover is a 404, the answer an unknown id gets; with none named, the
 * branch header's property, else the head office, else the first by name.
 *
 * Money: a folio balance is shown only to a caller who may read a bill
 * (`folio.charge` or `money.view`). The booking's own price and what the guest
 * paid are the reservation, readable by anyone who may read reservations.
 */
@Injectable()
export class FrontDeskBoardService {
  constructor(private readonly repo: FrontDeskBoardRepository) {}

  async board(
    ws: ScopedWorkspace,
    query: FrontDeskBoardQuery = {},
    now: Date = new Date(),
  ): Promise<FrontDeskBoard> {
    const covered = ws.branchScope.selectedPropertyId
      ? [ws.branchScope.selectedPropertyId]
      : [...ws.branchScope.propertyIds];
    if (query.propertyId && !covered.some((id) => id.toLowerCase() === query.propertyId?.toLowerCase())) {
      throw new NotFoundException('That property is not available to you.');
    }
    const candidates = await this.repo.properties(ws.workspaceId, query.propertyId ? [query.propertyId] : covered);
    const property = candidates[0];
    if (!property) throw new NotFoundException('There is no property on this desk.');

    const today = localToday(now);
    const canReadBills = ws.permissions.includes('folio.charge') || ws.permissions.includes('money.view');

    const [bookingRows, roomRows, typeRows] = await Promise.all([
      this.repo.bookings(ws.workspaceId, property.id, today),
      this.repo.rooms(ws.workspaceId, property.id, today),
      this.repo.roomTypes(ws.workspaceId, property.id),
    ]);
    const bookingIds = bookingRows.map((b) => b.id);
    const [holdRows, stayRows] = await Promise.all([
      this.repo.holds(bookingIds),
      this.repo.stays(ws.workspaceId, property.id, bookingIds),
    ]);

    const staysByBooking = new Map<string, BoardStayRow>();
    for (const stay of stayRows) {
      if (!stay.bookingId) continue;
      const seen = staysByBooking.get(stay.bookingId);
      // The open stay wins; among closed ones, the latest.
      if (!seen || (seen.lifecycle === 'closed' && (stay.lifecycle === 'open' || stay.entryAt > seen.entryAt))) {
        staysByBooking.set(stay.bookingId, stay);
      }
    }

    const startsAt = (checkIn: string): number =>
      Date.parse(`${checkIn}T${property.checkInTime ?? DEFAULT_CHECK_IN_TIME}:00+02:00`);
    const hasStay = new Set(stayRows.map((s) => s.bookingId).filter(Boolean));
    const bookings = bookingRows.map((row) =>
      this.presentBooking(row, holdRows.filter((h) => h.bookingId === row.id), staysByBooking.get(row.id) ?? null, canReadBills, {
        today,
        hoursBeforeCheckIn: (startsAt(row.checkIn) - now.getTime()) / 3_600_000,
        everCheckedIn: hasStay.has(row.id),
      }),
    );
    const stays = stayRows.map((row) => this.presentStay(row, canReadBills));
    const rooms = roomRows.map((row) => this.presentRoom(row));
    const roomTypes = typeRows.map((t): FrontDeskRoomType => {
      const ofType = roomRows.filter((r) => r.roomTypeId === t.id);
      return {
        id: t.id,
        name: t.name,
        sleeps: t.sleeps ?? 1,
        rateRwf: t.rateRwf,
        beds: t.beds,
        active: t.active,
        roomCount: ofType.length,
        freeTonight: t.active ? ofType.filter((r) => freeTonight(r, today)).length : 0,
      };
    });

    return {
      property,
      today,
      generatedAt: now.toISOString(),
      canReadBills,
      bookings,
      stays,
      rooms,
      roomTypes,
    };
  }

  private presentBooking(
    row: BoardBookingRow,
    holds: { roomId: string; roomLabel: string | null; from: string; to: string }[],
    stay: BoardStayRow | null,
    canReadBills: boolean,
    at: { today: string; hoursBeforeCheckIn: number; everCheckedIn: boolean },
  ): FrontDeskBooking {
    return {
      id: row.id,
      reference: row.reference,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      nights: Math.max(1, nightsBetween(row.checkIn, row.checkOut)),
      guestCount: row.guestCount,
      adults: row.adults,
      children: row.children,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      status: row.status as FrontDeskBooking['status'],
      state: deskState(row.status, stay?.lifecycle ?? null),
      bookingMode: row.bookingMode as FrontDeskBooking['bookingMode'],
      cancellationTier: row.cancellationTier as FrontDeskBooking['cancellationTier'],
      channel: row.channel as BookingChannel | null,
      eta: row.eta,
      deskNote: row.deskNote,
      totalRwf: row.grossRwf,
      lockedNightlyRateRwf: row.lockedNightlyRateRwf,
      paidRwf: paidRwf(row),
      paymentStatus: row.paymentStatus as FrontDeskBooking['paymentStatus'],
      approvalExpiresAt: row.approvalExpiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelledBy: row.cancelledBy,
      refundRwf: row.refundRwf,
      noShowAt: row.noShowAt?.toISOString() ?? null,
      noShowReason: row.noShowReason,
      holds: holds.map(({ roomId, roomLabel, from, to }) => ({ roomId, roomLabel, from, to })),
      preArrivalIdentity: row.preArrival,
      stay: stay
        ? { id: stay.id, reference: stay.reference, lifecycle: stay.lifecycle, roomLabel: stay.roomLabel }
        : null,
      folio: folioOf(row, canReadBills),
      guestMessage: row.guestMessage,
      cancellation: cancellationQuote(row, at),
      noShow: noShowQuote(row, at),
    };
  }

  private presentStay(row: BoardStayRow, canReadBills: boolean): FrontDeskStay {
    return {
      id: row.id,
      reference: row.reference,
      bookingId: row.bookingId,
      bookingReference: row.bookingReference,
      guestName: row.guestName,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      roomTypeName: row.roomTypeName,
      lifecycle: row.lifecycle,
      entryAt: row.entryAt.toISOString(),
      plannedExitAt: row.plannedExitAt?.toISOString() ?? null,
      actualExitAt: row.actualExitAt?.toISOString() ?? null,
      channel: row.channel as BookingChannel | null,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      deskNote: row.deskNote,
      departureNote: row.departureNote,
      priceRwf: row.priceRwf,
      folio: folioOf(row, canReadBills),
    };
  }

  private presentRoom(row: BoardRoomRow): FrontDeskRoom {
    return {
      id: row.id,
      label: row.label,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      status: row.status,
      housekeeping: row.housekeeping,
      housekeepingUpdatedAt: row.housekeepingUpdatedAt?.toISOString() ?? null,
      occupant: row.occupantStayId
        ? {
            stayId: row.occupantStayId,
            guestName: row.occupantName,
            plannedExitAt: row.occupantPlannedExitAt?.toISOString() ?? null,
          }
        : null,
      heldTonightBy:
        row.holdBookingId && row.holdReference
          ? { bookingId: row.holdBookingId, reference: row.holdReference, guestName: row.holdGuestName }
          : null,
    };
  }
}

/** When a property states no check-in time, the hour a stay is taken to start. */
const DEFAULT_CHECK_IN_TIME = '14:00';

/**
 * What cancelling at the guest's request would refund now, or null when the
 * command would refuse (the same refusals as `BookingCancellationService`):
 * not pending or confirmed, a stay opened against it, the stay already over,
 * or a payment no longer held. One function decides the money:
 * `cancellationRefund`, on the tier the booking locked.
 */
function cancellationQuote(
  row: BoardBookingRow,
  at: { today: string; hoursBeforeCheckIn: number; everCheckedIn: boolean },
): FrontDeskRefundQuote | null {
  if (row.status !== 'confirmed' && row.status !== 'pending_approval') return null;
  if (at.everCheckedIn || row.checkOut <= at.today) return null;
  if (row.escrowStatus && row.escrowStatus !== 'held') return null;
  const refund = cancellationRefund({
    party: 'guest',
    status: row.status,
    tier: row.cancellationTier as CancellationTier | null,
    nonRefundable: row.nonRefundable,
    grossRwf: row.escrowStatus ? row.escrowRwf : 0,
    hoursBeforeCheckIn: at.hoursBeforeCheckIn,
  });
  return { refundRwf: refund.refundRwf, keptRwf: refund.forfeitRwf, rule: refund.rule };
}

/**
 * What recording a no-show would refund now: a cancellation after the window
 * on the booking's tier. Null until the arrival day, and for anything but a
 * confirmed booking nobody checked in against.
 */
function noShowQuote(
  row: BoardBookingRow,
  at: { today: string; hoursBeforeCheckIn: number; everCheckedIn: boolean },
): FrontDeskRefundQuote | null {
  if (row.status !== 'confirmed' || at.everCheckedIn || row.checkIn > at.today) return null;
  if (row.escrowStatus && row.escrowStatus !== 'held') return null;
  // The function the no-show command moves the money with.
  const refund = noShowRefund({
    capturedRwf: row.escrowStatus ? row.escrowRwf : null,
    tier: row.cancellationTier as CancellationTier | null,
    nonRefundable: row.nonRefundable,
    hoursBeforeCheckIn: at.hoursBeforeCheckIn,
  });
  return { refundRwf: refund.refundRwf, keptRwf: refund.forfeitRwf, rule: refund.rule };
}

/** Same derivation as the reservations read: the desk state comes from the stay. */
function deskState(status: string, stay: 'open' | 'closed' | null): OperatorReservationState {
  switch (status) {
    case 'pending_approval':
      return 'pending';
    case 'declined':
      return 'declined';
    case 'cancelled':
      return 'cancelled';
    case 'no_show':
      return 'no_show';
    default:
      if (stay === 'open') return 'inhouse';
      if (stay === 'closed') return 'checked_out';
      return 'confirmed';
  }
}

/**
 * What the guest has paid and the business still holds or has been paid: the
 * escrow, less anything refunded. Nothing when no payment was taken.
 */
function paidRwf(row: BoardBookingRow): number {
  switch (row.paymentStatus) {
    case 'captured':
    case 'paid_out':
    case 'forfeited':
      return row.escrowRwf;
    case 'refunded_partial':
      return Math.max(0, row.escrowRwf - (row.refundRwf ?? 0));
    default:
      return 0;
  }
}

function folioOf(
  row: Pick<BoardBookingRow, 'folioId' | 'folioNumber' | 'folioStatus' | 'folioBalanceRwf' | 'folioLockedAt'>,
  canReadBills: boolean,
): FrontDeskFolio | null {
  if (!row.folioId || !row.folioNumber || !row.folioStatus) return null;
  return {
    id: row.folioId,
    folioNumber: row.folioNumber,
    status: row.folioStatus as FrontDeskFolio['status'],
    balanceRwf: canReadBills ? (row.folioBalanceRwf ?? 0) : null,
    lockedAt: row.folioLockedAt?.toISOString() ?? null,
  };
}

/** The Kigali day of an instant. */
function kigaliDay(at: Date): string {
  return localToday(at);
}

/**
 * Can this room still be sold for tonight? On sale, nobody staying past
 * today, and not held for a booking tonight.
 */
function freeTonight(room: BoardRoomRow, today: string): boolean {
  if (room.status !== 'available' || room.housekeeping === 'out_of_order') return false;
  const stayingOn = room.occupantStayId
    ? room.occupantPlannedExitAt === null || kigaliDay(room.occupantPlannedExitAt) > today
    : false;
  return !stayingOn && !room.holdBookingId;
}
