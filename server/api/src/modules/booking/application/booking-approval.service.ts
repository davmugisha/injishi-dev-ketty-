import type { BookingApprovalResult, BookingStatus } from '@injishi/contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import {
  type ApprovalOutcome,
  BookingRepository,
} from '../infrastructure/booking.repository';
import { BookingDecisionService } from './booking-decision.service';

/**
 * A host (org owner or manager) answering a request-to-book (F-B06).
 *
 * Authorises by org membership, then hands the transition itself to
 * `BookingDecisionService`, which is the only implementation of it (review
 * 1.1). This class owns nothing about money any more; it owns "may this person
 * decide this booking" and "how does the answer read to a host".
 */
@Injectable()
export class BookingApprovalService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly decisions: BookingDecisionService,
  ) {}

  /**
   * The booking, only if `userId` may manage it (F-B06). Null means "not
   * found" and "not yours" alike. A host cancellation authorises through this,
   * the same rule approve and decline use.
   */
  findManageable(bookingId: string, userId: string) {
    return this.bookings.findManageableBooking(bookingId, userId);
  }

  async approve(
    bookingId: string,
    userId: string,
  ): Promise<BookingApprovalResult> {
    await this.assertPendingAndAuthorized(bookingId, userId);
    return this.present(
      await this.decisions.approve(bookingId, {
        kind: 'guest_host',
        workspaceId: null,
      }),
    );
  }

  async decline(
    bookingId: string,
    userId: string,
  ): Promise<BookingApprovalResult> {
    await this.assertPendingAndAuthorized(bookingId, userId);
    return this.present(
      await this.decisions.decline(bookingId, {
        kind: 'guest_host',
        workspaceId: null,
      }),
    );
  }

  /**
   * 404 for a booking this person cannot manage, never 403: a refusal that
   * says "exists, not yours" confirms a booking id to whoever guessed it.
   */
  private async assertPendingAndAuthorized(
    bookingId: string,
    userId: string,
  ): Promise<void> {
    const booking = await this.bookings.findManageableBooking(
      bookingId,
      userId,
    );
    if (!booking) throw new NotFoundException('Booking not found.');
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
