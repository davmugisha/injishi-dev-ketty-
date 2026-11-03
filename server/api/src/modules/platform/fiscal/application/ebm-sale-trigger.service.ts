import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { PLATFORM, type Platform } from '../../../../shared/config/platform';
import { QUEUES } from '../../../../shared/queues/queues.module';
import { EBM_LIVE, type EbmLive } from '../domain/ebm-live';
import { emissionKeyFor } from '../domain/emission-keys';
import { EBM_SIGN_POINT, type SignPoint } from '../domain/sign-point';
import { EbmBookingRepository } from '../infrastructure/ebm-booking.repository';
import { EbmEmissionRepository } from '../infrastructure/ebm-emission.repository';

/** The job the worker runs for one sale. */
export const EMIT_JOB = 'emit';

/** Re-exported: the keys live in the domain, where the folio close mints them too. */
export { emissionKeyFor, folioEmissionKeyFor } from '../domain/emission-keys';

/**
 * The job id for one ATTEMPT at a row. Per attempt rather than per row, so a
 * retry is a new job: BullMQ keeps completed jobs, and re-adding a finished id
 * is silently ignored — a per-row id would let the first attempt's completion
 * swallow every retry after it.
 *
 * No colons. BullMQ 5 refuses a custom id containing `:` ("Custom Id cannot
 * contain :") except in the exact three-part shape it reserves for repeatable
 * jobs — an id that only works because it happens to match that exception is
 * one refactor from failing every enqueue.
 */
export function emitJobId(emissionId: string, attempts: number): string {
  return `emit_${emissionId}_${attempts}`;
}

/**
 * Where a confirmed sale enters the EBM pipeline (F-B13, ADR-041).
 *
 * Called when a booking becomes a CONFIRMED sale with captured money — at
 * creation for instant book, at approval for request to book. Not at capture:
 * a request-to-book booking is captured before the host decides, and a sale the
 * host then declines is refunded. Certifying it at capture would declare a sale
 * that never happened and then need a refund receipt (clause 14, `NR`), which
 * is not built.
 *
 * THE TABLE IS THE TRUTH; THE QUEUE IS THE WAKE-UP (the rule
 * `PaymentCompensationService` set). The held row is written first; the job is
 * only a nudge. If Redis is down the row still sits due and the worker's drain
 * picks it up; if the row write itself fails, the reconcile sweep finds the
 * confirmed booking with no row and writes it. Nothing here is allowed to fail
 * the booking — the guest's reservation is already committed, and a tax
 * pipeline hiccup must never be what un-confirms it.
 */
@Injectable()
export class EbmSaleTrigger {
  private readonly log = new Logger(EbmSaleTrigger.name);

  constructor(
    private readonly emissions: EbmEmissionRepository,
    private readonly bookings: EbmBookingRepository,
    @InjectQueue(QUEUES.ebmEmission) private readonly queue: Queue,
    @Inject(PLATFORM) private readonly platform: Platform,
    @Inject(EBM_LIVE) private readonly live: EbmLive | null,
    @Inject(EBM_SIGN_POINT) private readonly signPoint: SignPoint,
  ) {}

  /** Never throws. */
  async saleConfirmed(bookingId: string): Promise<void> {
    /**
     * STAMP FIRST, and in every mode (ADR-050 D-a).
     *
     * The stamp records which fiscal RULE this booking was confirmed under, not
     * whether anything was declared, so it is not the adapter's business. A
     * booking confirmed in mock and closed after a switch to live still has to
     * know which rule it was made under, and `FolioService.close` reads only
     * this column.
     */
    try {
      await this.bookings.stampSignPoint(bookingId, this.signPoint);
    } catch (error) {
      this.log.error(
        `Booking ${bookingId} could not be stamped with the EBM sign point: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    // Mock mode keeps its existing shape — a receipt signed on read — and
    // writes nothing: a mock row in `ebm_invoices` would be a record of a
    // declaration that was never made.
    if (!this.live) return;

    try {
      const recorded = await this.record(bookingId);
      // Only a row this call created is woken. A row that already existed
      // belongs to whoever created it — its first wake-up or the drain — and
      // it may be several attempts in, where a job id for attempt 0 would be
      // stale.
      if (recorded?.created) await this.wake(recorded.id, 0);
    } catch (error) {
      this.log.error(
        `EBM sale for booking ${bookingId} not recorded on confirm; the reconcile sweep will pick it up: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Write the held row for a booking. Null when it does not belong in the
   * pipeline — no org behind the workspace means no taxpayer to invoice for.
   */
  async record(bookingId: string): Promise<{ id: string; created: boolean } | null> {
    // The demo environment's businesses are fictional and its bookings are
    // play. Nothing from it is ever declared to RRA, whatever the mode says
    // (ADR-041 D-p; a demo process also refuses to boot in live mode, ADR-043).
    if (this.platform.environment === 'demo') return null;

    const booking = await this.bookings.findForEmission(bookingId);
    if (!booking?.orgId) {
      this.log.warn(`Booking ${bookingId} has no business behind it; no EBM sale recorded`);
      return null;
    }

    /**
     * WHICH DOCUMENT A CONFIRMATION RAISES (ADR-050 D-a, AC-1).
     *
     * Under `checkout` a confirmed booking raises a PROFORMA. It carries the
     * accommodation total at the locked rate and the payment the platform took,
     * it has no receipt signature (§6.3.6) and it prints
     * `THIS IS NOT AN OFFICIAL RECEIPT` (§11). The sale itself is declared once,
     * when the bill is closed, because signing the room at confirmation AND the
     * folio at settlement declares the room twice.
     *
     * Both paths stay live during the cutover, which is what makes the switch
     * reversible.
     *
     * Read from the booking's STAMP, not from `this.signPoint`. The reconcile
     * sweep calls this long after confirmation for a booking whose first write
     * failed, and if the flag was flipped in between, the flag would pick the
     * wrong document. An absent stamp reads `booking`.
     */
    const proforma = (await this.bookings.signPointFor(bookingId)) === 'checkout';
    return this.emissions.insertHeld({
      source: 'booking',
      bookingId,
      orgId: booking.orgId,
      tin: booking.sellerTin,
      receiptType: proforma ? 'proforma' : 'normal',
      customerName: null,
      idempotencyKey: emissionKeyFor(bookingId, proforma ? 'PS' : 'NS'),
      dueAt: new Date(),
    });
  }

  /** Best effort. A lost wake-up costs one drain interval, never the sale. */
  async wake(emissionId: string, attempts: number): Promise<boolean> {
    try {
      await this.queue.add(
        EMIT_JOB,
        { emissionId },
        {
          jobId: emitJobId(emissionId, attempts),
          // One attempt per job. Retrying is the DATABASE's decision (the
          // row's next_attempt_at), never BullMQ's: BullMQ retrying a job whose
          // send timed out would be exactly the blind resend this design exists
          // to prevent.
          attempts: 1,
          removeOnComplete: { age: 7 * 24 * 3600 },
          removeOnFail: false,
        },
      );
      return true;
    } catch (error) {
      this.log.warn(
        `EBM wake-up for ${emissionId} not queued; the drain will retry it: ` +
          (error instanceof Error ? error.message : String(error)),
      );
      return false;
    }
  }
}
