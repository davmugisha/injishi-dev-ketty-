import type { BookingStatus } from '@injishi/contracts';

/**
 * WHAT MAKES A BOOKING STILL WORTH TALKING ABOUT (ADR-050 D-q).
 *
 * A guest who has booked and not yet arrived has no stay, so every guest-side
 * route that resolved ownership through `guest_stays` was closed to them: they
 * could reach no department of the property at all until a receptionist checked
 * them in. The booking is what stands in for the stay until then, and this file
 * is the ONE definition of which bookings count.
 *
 * Two conditions, and each one is a refusal somebody would otherwise have to
 * think about at every call site:
 *
 *  - **It has not ended.** A `cancelled` or `declined` booking is a room this
 *    person does not hold; messaging Housekeeping about it is a message nobody
 *    can act on. The set is deliberately the same one `tripStage` reads to
 *    decide a trip is `cancelled` — two answers to "is this booking dead" is
 *    one answer too many, and a guest who sees "Cancelled" on `/trips` must not
 *    be offered the property's desks on the next screen.
 *  - **Its checkout has not passed.** Against today in the PROPERTY's calendar,
 *    and checkout DAY still counts: a guest leaving this morning has not
 *    finished their stay, which is the same boundary `tripStage` draws between
 *    `in_progress` and `past`.
 *
 * `no_show` is deliberately NOT ended. It is a stay that happened — the room
 * was held, the money moved, nobody arrived — and its checkout has passed by
 * definition, so the date rule already refuses it. Listing it as ended would
 * say something different and equally true in the wrong place.
 *
 * `pending_approval` IS live. A request to book that the host has not answered
 * is the moment a guest most wants to ask a question, and the property's own
 * control over who may be written to is `departments.guest_requestable`, not
 * the state of the booking.
 *
 * Kept free of a database and of a clock: the repository renders these two
 * rules as SQL once (`liveBookingWhere`), and the predicate below is the same
 * rules for a row already in memory. There is no third copy.
 */

/** Statuses that end a booking, whatever its dates still say. */
export const ENDED_BOOKING_STATUSES: readonly BookingStatus[] = [
  'cancelled',
  'declined',
];

/** The facts a booking is judged live by, and nothing else. */
export interface BookingLifeline {
  status: BookingStatus;
  /** `bookings.check_out`, a `yyyy-mm-dd` date in the property's calendar. */
  checkOut: string;
}

/**
 * Is this booking still live, against `today` in the property's calendar?
 *
 * Dates compare as `yyyy-mm-dd` strings, which is why `today` is one: ISO order
 * is lexical order, so there is no arithmetic and no timezone drift at the
 * boundary. Pass ONE `today` for a whole request, so two places cannot land on
 * different sides of midnight while one answer is being built.
 */
export function isLiveBooking(booking: BookingLifeline, today: string): boolean {
  return (
    !ENDED_BOOKING_STATUSES.includes(booking.status) && booking.checkOut >= today
  );
}
