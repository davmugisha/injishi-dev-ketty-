import { Injectable, Logger } from '@nestjs/common';

import { reportAlarm } from '../../../shared/observability/error-reporter';
import { type CompletedStay, StayCompletionRepository } from '../infrastructure/stay-completion.repository';

/**
 * Check out ends the booking and pays the host (0116).
 *
 * **It never throws.** The guest has left, the room is dirty and the bill is
 * signing: a payout that cannot be written now is logged and alarmed, and the
 * check out still answers 200. Nothing is lost by waiting, because the escrow
 * stays `held` and the booking uncompleted until this runs again.
 */
@Injectable()
export class StayCompletionService {
  private readonly log = new Logger(StayCompletionService.name);

  constructor(private readonly repo: StayCompletionRepository) {}

  async completeBooking(bookingId: string): Promise<CompletedStay | null> {
    try {
      const done = await this.repo.complete(bookingId);
      if (done?.payout) {
        this.log.log(
          `Booking ${done.reference} completed; RWF ${done.payout.amountRwf} ${
            done.payout.status === 'queued' ? `queued to ${done.payout.destinationMasked}` : 'held: no payout account'
          }.`,
        );
      }
      return done;
    } catch (cause) {
      this.log.error(
        `Booking ${bookingId} checked out but was not completed: ${cause instanceof Error ? cause.message : 'unknown failure'}.`,
      );
      reportAlarm('STAY_COMPLETION_FAILED', 'A checked-out booking was not completed or paid out.', { bookingId }, cause);
      return null;
    }
  }
}
