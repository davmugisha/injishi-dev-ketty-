/**
 * What a guest is told about their own booking, and when (ADR-047).
 *
 * ## The gap this closes
 *
 * Nothing in this platform sent a guest anything about a booking. The only
 * consumer of `MAILER_PORT` was `OtpMailer`, and the only consumer of
 * `SMS_PORT` was its phone twin — so a person who paid got one confirmation
 * screen and, the moment they closed the tab, no way back to a reference that
 * is the key to their own fiscal receipt.
 *
 * The worst case was quieter and worse. A `request_to_book` whose host never
 * answers is auto-declined by a sweep that runs every five minutes, up to 24
 * hours later, and refunded in full. That is the right behaviour and it was
 * completely silent: the guest was told nothing, at the moment their plans
 * stopped being real.
 *
 * ## Why the job carries an ID and not a message
 *
 * A queued job is a row in Redis. Putting the guest's address, the property
 * name and the amount on it would copy personal data into a second store with
 * its own retention, its own backups and nobody's eyes on it. The job carries
 * the booking id and the event; the processor reads what it needs at send time
 * and composes there.
 *
 * It also means a job that sits in the queue through a retry cannot deliver a
 * stale fact. A booking that was declined while its "confirmed" mail was still
 * queued is read as declined when the job finally runs.
 */

/** The five moments a guest hears from us about one booking. */
export const BOOKING_MAIL_EVENTS = [
  /** Instant-book: the room is held and the money is in escrow. */
  'confirmed',
  /** Request-to-book: the request is in, the host has a window to answer. */
  'request_sent',
  /** The host said yes. */
  'approved',
  /** The host said no. Refunded in full. */
  'declined',
  /** Nobody answered inside the window. Refunded in full. */
  'expired',
] as const;

export type BookingMailEvent = (typeof BOOKING_MAIL_EVENTS)[number];

/** The BullMQ job name on `QUEUES.email` that this module owns. */
export const BOOKING_MAIL_JOB = 'booking-mail';

/** Everything one queued booking mail needs. Deliberately just two fields. */
export interface BookingMailJob {
  bookingId: string;
  event: BookingMailEvent;
}

/**
 * The job id, and why it is derived rather than random.
 *
 * BullMQ deduplicates by job id, so this makes the whole path idempotent for
 * free: a service that raises "confirmed" twice for one booking — a retry, a
 * reconcile sweep, two replicas racing — queues one job and sends one email.
 * The same reasoning the payment seam applies to an idempotency key, applied to
 * a mailbox, because a guest who gets the same confirmation four times learns
 * that our mail is noise.
 */
export function bookingMailJobId(job: BookingMailJob): string {
  return `${BOOKING_MAIL_JOB}:${job.bookingId}:${job.event}`;
}
