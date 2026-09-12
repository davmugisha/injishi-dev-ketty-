import type {
  OperatorReservation,
  OperatorReservationQuery,
  OperatorReservationState,
  WorkspaceAccess,
} from '@injishi/contracts';
import { ConflictException, Injectable } from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { localToday, nightsBetween } from '../domain/pricing';
import {
  DESK_WINDOW_DAYS,
  type DeskFilter,
  type OperatorReservationRow,
  BookingRepository,
} from '../infrastructure/booking.repository';
import { BookingDecisionService } from './booking-decision.service';

/**
 * The front desk's view of reservations (ADR-012, `/api/v1/ops/reservations`).
 *
 * Authorises by workspace, then hands approve and decline to
 * `BookingDecisionService` (review 1.1). This class used to call the
 * repository's `decline()` directly, which marked the escrow refunded without
 * ever instructing the provider — the ledger said the guest had their money
 * back and the provider still held it (review 3.1). It no longer knows how to
 * move money at all, which is the point.
 */
@Injectable()
export class OperatorReservationsService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly decisions: BookingDecisionService,
  ) {}

  async list(
    ws: WorkspaceAccess,
    query: OperatorReservationQuery = {},
  ): Promise<OperatorReservation[]> {
    const rows = await this.bookings.listOperatorReservations(
      ws.workspaceId,
      deskFilterFor(query),
    );
    const presented = rows.map((row) => this.present(row));
    // `inhouse` and `checked_out` are derived from the stay, not stored on the
    // booking, so those two narrow here after the read (review 2.5).
    return query.state
      ? presented.filter((r) => r.state === query.state)
      : presented;
  }

  async approve(
    ws: WorkspaceAccess,
    bookingId: string,
  ): Promise<OperatorReservation> {
    await this.assertOwnedAndPending(ws, bookingId);
    await this.decisions.approve(bookingId, {
      kind: 'operator',
      workspaceId: ws.workspaceId,
    });
    return this.readBack(bookingId);
  }

  async decline(
    ws: WorkspaceAccess,
    bookingId: string,
  ): Promise<OperatorReservation> {
    await this.assertOwnedAndPending(ws, bookingId);
    await this.decisions.decline(bookingId, {
      kind: 'operator',
      workspaceId: ws.workspaceId,
    });
    return this.readBack(bookingId);
  }

  private async assertOwnedAndPending(
    ws: WorkspaceAccess,
    bookingId: string,
  ): Promise<void> {
    const owner = await this.bookings.findReservationOwner(bookingId);
    const row = assertOwned(owner, ws);
    if (row.status !== 'pending_approval') {
      throw new ConflictException(this.resolvedMessage(row.status));
    }
  }

  private async readBack(bookingId: string): Promise<OperatorReservation> {
    const row = await this.bookings.findOperatorReservation(bookingId);
    if (!row) {
      throw new ConflictException(
        'This request was just resolved. Refresh to see where it stands.',
      );
    }
    return this.present(row);
  }

  private present(row: OperatorReservationRow): OperatorReservation {
    return {
      id: row.id,
      reference: row.reference,
      guestName: row.guestName,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      // One definition of a night (review 4.1); a desk row never shows fewer
      // than one because a stored booking always has at least one.
      nights: Math.max(1, nightsBetween(row.checkIn, row.checkOut)),
      guestCount: row.guestCount,
      state: deskState(row),
      bookingStatus: row.status,
      room: row.roomLabel,
      roomTypeId: row.roomTypeId,
      totalRwf: row.grossRwf,
      approvalExpiresAt: row.approvalExpiresAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
    };
  }

  private resolvedMessage(status: OperatorReservationRow['status']): string {
    switch (status) {
      case 'confirmed':
        return 'This request was already approved.';
      case 'declined':
        return 'This request was already declined or expired, and refunded.';
      case 'cancelled':
        return 'This booking was cancelled.';
      case 'no_show':
        return 'This booking is closed.';
      default:
        return 'This request is no longer pending approval.';
    }
  }
}

/** The desk window (review 2.5): the last 90 days of departures onward. */
function deskFilterFor(query: OperatorReservationQuery): DeskFilter {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - DESK_WINDOW_DAYS);
  const filter: DeskFilter = { since: localToday(since) };
  switch (query.state) {
    case 'pending':
      return { ...filter, statuses: ['pending_approval'] };
    case 'declined':
    case 'cancelled':
    case 'no_show':
      return { ...filter, statuses: [query.state] };
    case 'confirmed':
    case 'inhouse':
    case 'checked_out':
      return { ...filter, statuses: ['confirmed'] };
    default:
      return filter;
  }
}

function deskState(row: OperatorReservationRow): OperatorReservationState {
  switch (row.status) {
    case 'pending_approval':
      return 'pending';
    case 'declined':
      return 'declined';
    case 'cancelled':
      return 'cancelled';
    case 'no_show':
      return 'no_show';
    case 'confirmed':
      if (row.stayLifecycle === 'open') return 'inhouse';
      if (row.stayLifecycle === 'closed') return 'checked_out';
      return 'confirmed';
  }
}
