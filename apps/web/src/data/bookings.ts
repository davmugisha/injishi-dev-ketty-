import type {
  BookableRoom,
  CreateBookingInput,
  CreateBookingOutcome,
  PaymentAttemptStatus,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for the two calls checkout makes (F-B05 / FL07, ADR-020).
 *
 * It goes through `apiFetch`, which is the one definition of where the API is.
 * The page it replaced called `fetch("/api/v1/bookings")` with a RELATIVE path,
 * which resolves to the Next app on :3000 rather than the API on :8000, so the
 * request never reached a booking service at all. It also sent
 * `propertyId: <slug>` where the contract requires `roomTypeId` as a uuid, so
 * even reaching the right port it would have been refused. Neither fault was
 * visible on the screen: the button spun and then said something generic.
 *
 * Going through `apiFetch` also brings the two things that call needed and did
 * not have: `credentials: "include"`, without which the session cookie stays on
 * the API origin and a signed-in guest is answered 401, and a timeout, without
 * which a hung request leaves the confirm button spinning for ever.
 */

/**
 * Load the room behind a checkout link, and the property it belongs to.
 *
 * ## What changed, and why it is not a refactor
 *
 * This used to call `GET /api/v1/properties/:id`, take the whole property
 * document — description, house rules, coordinates, every photo, every OTHER
 * room type — and pick one room out of the array client-side. Two things were
 * wrong with that beyond the waste.
 *
 * The first is that it needed a property id, so the checkout url carried a PAIR
 * of ids and the server trusted them as a pair. Checking that the room belonged
 * to the property was a client-side `find()`, which is a check a hand-edited
 * link is free to pass by naming a real room on a real property that is not the
 * one whose page the guest came from.
 *
 * The second is that the checkout could not name the property at all without a
 * second source. It looked it up in `data/properties.ts` — 130 KB of curated
 * fixtures shipped to the browser — and refused to render for any property that
 * did not have a hand-written row there. Real inventory in the database was
 * therefore unbookable: the API would have served it happily and the screen
 * said "We could not read that booking".
 *
 * `GET /api/v1/bookable/:roomTypeId` answers both. The property is JOINED to
 * the room type on the server, so there is no pair left to disagree, and it
 * comes back with the six fields the checkout actually shows. The fixture is
 * off this path entirely.
 */
export function fetchBookableRoom(
  roomTypeId: string,
): Promise<ApiResult<BookableRoom>> {
  return apiFetch<BookableRoom>(`/api/v1/bookable/${roomTypeId}`);
}

/**
 * Create the booking and capture into escrow.
 *
 * The body is exactly `CreateBookingInput` and carries no money. The server
 * re-derives every amount from the room type's own rate and ignores anything a
 * client sends, which is what stops a tampered payload under-charging itself —
 * so sending a total here would be at best ignored and at worst misleading.
 *
 * It DOES now carry the payment instrument (ADR-047): which rail, and the
 * handset or provider token to charge. That is not money, it is WHO to ask for
 * it, and the server cannot capture without it.
 */
export function createBooking(
  input: CreateBookingInput,
): Promise<ApiResult<CreateBookingOutcome>> {
  return apiFetch<CreateBookingOutcome>("/api/v1/bookings", {
    method: "POST",
    body: input,
  });
}

/**
 * Where did my payment get to? (ADR-047 D-j)
 *
 * A mobile money capture does not settle inside the request: the provider
 * pushes a prompt to a handset and the guest LEAVES this app to approve it.
 * `createBooking` therefore answers `awaiting_payment`, and this is what the
 * waiting screen asks until the money lands or the prompt times out.
 *
 * Safe to call in a loop, and safe to call again after a reload: the attempt is
 * a row on the server, not state in this tab, so a guest who closes the browser
 * mid-payment has not lost the charge — which is exactly what the old
 * "press confirm again" flow could not say.
 */
export function fetchPaymentAttempt(
  attemptToken: string,
): Promise<ApiResult<PaymentAttemptStatus>> {
  return apiFetch<PaymentAttemptStatus>(
    `/api/v1/bookings/attempts/${encodeURIComponent(attemptToken)}`,
  );
}
