import { queueJobId } from '../../../shared/queues/job-id';

/**
 * What a payer is told about a refund owed to them (073-gtbank-payments
 * AC-12, AC-12a).
 *
 * Keyed by the refund's transaction, not by a booking, because a registrant's
 * duplicate fee refund has no booking and the payer must still hear of it. The
 * job carries the id and the event and nothing else, exactly as a booking mail
 * does (ADR-047): the address, the amount and the reference are read at send
 * time, so no personal data sits in Redis and a stale fact is never delivered.
 */
export const REFUND_MAIL_EVENTS = [
  /** The refund waits for the payer's full name and ID (AC-12). */
  'refund_details_needed',
  /** The bank refused it, or it is above the limit; Injishi is on it (AC-12a). */
  'refund_delayed',
] as const;

export type RefundMailEvent = (typeof REFUND_MAIL_EVENTS)[number];

/** The BullMQ job name on `QUEUES.email`, beside `BOOKING_MAIL_JOB`. */
export const REFUND_MAIL_JOB = 'refund-mail';

export interface RefundMailJob {
  transactionId: string;
  event: RefundMailEvent;
}

/** One mail per refund per event: raising it twice queues one job. */
export function refundMailJobId(job: RefundMailJob): string {
  return queueJobId(`${REFUND_MAIL_JOB}:${job.transactionId}:${job.event}`);
}

/**
 * Does the event still describe the refund as it stands? A details request
 * that retries after the payer typed them, or a delay notice after the refund
 * went out, is skipped.
 */
export function refundMailStillTrue(
  event: RefundMailEvent,
  row: { status: string; queueReason: string | null },
): boolean {
  switch (event) {
    case 'refund_details_needed':
      return row.status === 'queued' && row.queueReason === 'payee_details_missing';
    case 'refund_delayed':
      return row.status === 'failed' || (row.status === 'queued' && row.queueReason === 'over_limit');
    default:
      return false;
  }
}
