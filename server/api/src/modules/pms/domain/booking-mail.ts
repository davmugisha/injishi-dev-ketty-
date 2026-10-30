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

/**
 * The moments a guest, or the property, hears from us about one booking.
 *
 * The first six go to the guest. The two `host_*` events go to every active
 * owner and manager of the property's organisation: until the booking audit of
 * 2026-09-13 nothing told a host that a request was waiting on them, so a
 * request could sit for its whole approval window and auto-decline unseen.
 */
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
  /** The booking was cancelled, by either side, with its refund (F-B11). */
  'cancelled',
  /** The desk changed the booking's dates, room type or party (0120). One mail per change. */
  'changed',
  /** To the property: a request is waiting for an answer. */
  'host_request',
  /**
   * To the property: an instant booking is in, paid and confirmed. Instant
   * book is the default, and until 2026-10-29 the property heard of one only
   * by opening Reservations.
   */
  'host_confirmed',
  /** To the property: the guest cancelled. */
  'host_guest_cancelled',
  /**
   * To the property: the bank reversed the guest's payment and the booking is
   * cancelled with no refund (073-gtbank-payments AC-20, `cancel_service`).
   */
  'host_payment_reversed',
] as const;

/** Events addressed to the property's managers rather than to the guest. */
export const HOST_MAIL_EVENTS: ReadonlySet<BookingMailEvent> = new Set([
  'host_request',
  'host_confirmed',
  'host_guest_cancelled',
  'host_payment_reversed',
]);

export type BookingMailEvent = (typeof BOOKING_MAIL_EVENTS)[number];

/** The BullMQ job name on `QUEUES.email` that this module owns. */
export const BOOKING_MAIL_JOB = 'booking-mail';

/** Everything one queued booking mail needs. Deliberately just two fields. */
export interface BookingMailJob {
  bookingId: string;
  event: BookingMailEvent;
  /** On `changed`: the change it tells of, so a second change is a second mail (0120). */
  changeId?: string;
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
  // Three colon parts at most: BullMQ refuses a custom id with more ("Custom Id cannot contain :"), so a
  // change's id joins the event with a hyphen (0120).
  return `${BOOKING_MAIL_JOB}:${job.bookingId}:${job.event}${job.changeId ? `-${job.changeId}` : ''}`;
}
