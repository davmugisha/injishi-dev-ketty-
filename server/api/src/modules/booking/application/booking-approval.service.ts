import type {
  BookingApprovalResult,
  BookingStatus,
  WorkspaceAccess,
} from '@injishi/contracts';
import { ConflictException, Injectable } from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  type ApprovalOutcome,
  BookingRepository,
} from '../infrastructure/booking.repository';
import { BookingDecisionService } from './booking-decision.service';

/**
 * A host answering a request-to-book through `/bookings/:id/approve` and
 * `/decline` (F-B06).
 *
 * WHO MAY IS THE GUARD'S QUESTION NOW (ADR-049, AC-A5). The routes run behind
 * `WorkspaceGuard` and declare `reservation.approve`, the same permission the
 * `/ops/reservations` door declares, so a receptionist may decide through both
 * doors and a business that is not `active` through neither. This used to join
 * a hardcoded `['owner', 'manager']` onto the membership, which refused a
 * receptionist the permission says may act and never asked about the
 * registration gate at all: a suspended business could still approve bookings.
 *
 * What is left here is containment and the state check. The transition itself
 * is `BookingDecisionService`, the only implementation of it (review 1.1).
 */
@Injectable()
export class BookingApprovalService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly decisions: BookingDecisionService,
  ) {}

  async approve(
    bookingId: string,
    ws: WorkspaceAccess,
  ): Promise<BookingApprovalResult> {
    await this.assertOwnedAndPending(bookingId, ws);
    return this.present(
      await this.decisions.approve(bookingId, {
        kind: 'guest_host',
        workspaceId: ws.workspaceId,
      }),
    );
  }

  async decline(
    bookingId: string,
    ws: WorkspaceAccess,
  ): Promise<BookingApprovalResult> {
    await this.assertOwnedAndPending(bookingId, ws);
    return this.present(
      await this.decisions.decline(bookingId, {
        kind: 'guest_host',
        workspaceId: ws.workspaceId,
      }),
    );
  }

  /**
   * The booking must sit in the workspace the caller named, and still be
   * pending. `assertOwned` answers 404 rather than 403 for a booking in another
   * workspace, because "exists, not yours" confirms a booking id to whoever
   * guessed it; the same helper the `/ops` door uses, so the two cannot differ.
   */
  private async assertOwnedAndPending(
    bookingId: string,
    ws: WorkspaceAccess,
  ): Promise<void> {
    const owner = await this.bookings.findReservationOwner(bookingId);
    const booking = assertOwned(owner, ws);
    if (booking.status !== 'pending_approval') {
      throw new ConflictException(this.resolvedMessage(booking.status));
    }
  }

  private present(outcome: ApprovalOutcome): BookingApprovalResult {
    return {
      id: outcome.id,
      reference: outcome.reference,
      status: outcome.status,
      declineReason: outcome.declineReason,
      paymentStatus: outcome.paymentStatus,
      escrowStatus: outcome.escrowStatus,
      confirmedAt: outcome.confirmedAt?.toISOString() ?? null,
    };
  }

  private resolvedMessage(status: BookingStatus): string {
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
