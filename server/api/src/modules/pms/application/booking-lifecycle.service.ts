import { Inject, Injectable, Logger } from '@nestjs/common';

import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import { releaseKeyFor } from '../../payments/domain/keys';
import {
  PAYMENT_PORT,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import {
  BookingRepository,
  type ExpiredRequest,
  type HeldEscrow,
} from '../infrastructure/booking.repository';
import { BookingNotificationsService } from './booking-notifications.service';
import { BookingRefunds } from './booking-refunds';

/** How many releases are in flight toward the provider at once (review 2.4). */
const RELEASE_CONCURRENCY = 4;

/**
 * Auto-decline of request-to-book holds whose window closed (F-B06 §10).
 *
 * The repository claims a bounded batch (review 2.4), so two workers never
 * chase the same hold and one sweep never has to release a thousand. Releases
 * run a few at a time rather than one after another: the provider is the slow
 * part, and a serial loop made a sweep of fifty holds a fifty-round-trip job.
 *
 * Declined now, released owed (073-gtbank-payments AC-13): a payment the bank
 * record holds is declined with its release written in one transaction, and
 * the disbursement dispatcher sends it. A payment from before the bank record
 * keeps the old order, provider first and ledger second (ADR-020 D-h): a
 * release the provider did not confirm leaves the hold standing and is queued,
 * never recorded on optimism.
 */
@Injectable()
export class BookingLifecycleService {
  private readonly logger = new Logger(BookingLifecycleService.name);

  constructor(
    private readonly bookings: BookingRepository,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly compensations: PaymentCompensationService,
    private readonly notifications: BookingNotificationsService,
    private readonly refunds: BookingRefunds,
  ) {}

  async expireStaleRequests(now: Date = new Date()): Promise<number> {
    const candidates = await this.bookings.findExpiredRequests(now);
    if (candidates.length === 0) return 0;

    const confirmed: string[] = [];
    const owed: ExpiredRequest[] = [];
    await forEachLimited(candidates, RELEASE_CONCURRENCY, async (escrow) => {
      // Declined now, released owed (073-gtbank-payments AC-13), one booking
      // per transaction. A payment from before the bank record is released
      // through the provider first and recorded with the batch below.
      const plan =
        escrow.amountRwf == null
          ? null
          : await this.refunds.plan({
              reference: escrow.reference,
              bookingId: escrow.bookingId,
              workspaceId: escrow.workspaceId,
              adapterRef: escrow.adapterRef,
              idempotencyKey: releaseKeyFor(escrow),
              operation: 'escrow_release_guest',
            });
      if (plan && escrow.amountRwf != null) {
        const declined = await this.bookings.recordExpiredDecline(escrow.bookingId, {
          owe: plan.oweTx,
          amountRwf: escrow.amountRwf,
        });
        if (declined) {
          owed.push(declined);
          await plan.announce();
        }
        return;
      }
      if (await this.release(escrow)) confirmed.push(escrow.bookingId);
    });

    const expired = [...owed, ...(await this.bookings.recordExpiredDeclines(confirmed))];
    if (expired.length > 0) {
      const refs = expired.map((row) => row.reference).join(', ');
      this.logger.log(
        `Auto-declined ${expired.length} expired request${
          expired.length === 1 ? '' : 's'
        } (released 100% to the guest): ${refs}`,
      );

      /*
       * TELL THEM (ADR-047).
       *
       * This was the quietest failure in the product. A guest requested a room,
       * was charged, waited, and up to a day later a sweep they never saw
       * declined the request and refunded them — with no email, no SMS, and a
       * Trips page that could not list the booking. The money came back and the
       * person was never told why, or that it had.
       *
       * One mail per expired booking, queued and deduplicated by job id, after
       * the ledger is recorded so the message cannot describe a refund the
       * sweep then failed to write. `notify` never throws: a mail relay must
       * not break a sweep that is holding other people's money.
       */
      for (const row of expired) {
        await this.notifications.notify(row.id, 'expired');
      }
    }
    return expired.length;
  }

  /** True when the provider confirmed the release. */
  private async release(escrow: HeldEscrow): Promise<boolean> {
    const memo = 'Auto-decline: approval window closed with no answer';
    if (!escrow.adapterRef || escrow.amountRwf == null) {
      // A row written before the seam existed has no provider reference, and
      // a row with no amount is malformed. Either way there is nothing this
      // can instruct. Left held and reported rather than marked refunded,
      // because we cannot know that it was.
      this.logger.error(
        `Cannot release escrow ${escrow.escrowId} for ${escrow.reference}: ` +
          'the row carries no adapter reference or no amount. It keeps its hold.',
      );
      return false;
    }

    const releaseKey = releaseKeyFor(escrow);
    const amountRwf = escrow.amountRwf;
    try {
      await this.payments.releaseEscrow({
        kind: 'escrow_release',
        beneficiary: 'guest',
        idempotencyKey: releaseKey,
        originalRef: escrow.adapterRef,
        amountRwf,
        currency: 'RWF',
        workspaceId: escrow.workspaceId,
        memo,
      });
      return true;
    } catch (err) {
      // Unconfirmed. The hold stands, the booking stays pending, and the
      // queue chases it on the same key — so a release that did land after
      // all replays instead of running twice.
      await this.compensations.enqueue({
        kind: 'release-escrow',
        idempotencyKey: releaseKey,
        workspaceId: escrow.workspaceId,
        originalRef: escrow.adapterRef,
        amountRwf,
        bookingId: escrow.bookingId,
        memo,
      });
      this.logger.warn(
        `Release not confirmed for ${escrow.reference} (escrow ` +
          `${escrow.escrowId}, key ${releaseKey}). Queued; still held. ` +
          (err instanceof Error ? err.message : String(err)),
      );
      return false;
    }
  }
}

/** Run `work` over `items` with at most `limit` in flight. Never rejects. */
async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      try {
        await work(item);
      } catch {
        // `work` reports its own failures; a lane must not stop on one.
      }
    }
  });
  await Promise.all(lanes);
}
