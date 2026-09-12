/**
 * From a thing a screen is holding, to the stay it belongs to.
 *
 * **This module exists because five screens had five answers, and four of them
 * were wrong.** `Today`, the room grid popover, the command bar and
 * `Reservations` each built `/w/{ws}/stays/{id}/folio` out of whatever id was
 * nearest to hand — a demo reservation id on three of them, a booking id on the
 * fourth. `screens/stay.tsx` resolves that segment against `GET /ops/stays` and
 * calls `notFound()` when nothing matches, so every one of those buttons landed
 * on "We can't find that page". The check-in drawer was the only caller with a
 * real `OperatorStay` in hand, and the only one that worked.
 *
 * **A STAY IS NOT A BOOKING AND IT IS NOT A ROOM.** A stay does not exist until
 * somebody arrives, it can outlive the booking that started it, and a walk-in
 * has no booking at all. So the id a screen holds is almost never the id the
 * address wants, and the join has to happen somewhere. It happens HERE, once,
 * rather than at each call site — the alternative is what this codebase already
 * had.
 *
 * The three joins below are the ones the database already carries; none of them
 * is invented here:
 *
 * - `OperatorStay.bookingId` — the booking a stay grew out of, null for a
 *   walk-in.
 * - `OperatorRoom.occupiedBy.stayId` — the OPEN stay in a room, null when the
 *   room is empty. A closed stay is deliberately not reachable this way: the
 *   room has moved on, and "the bill for room 204" means tonight's guest.
 * - `OperatorFolio.guestStayId` — the bill a stay is running.
 *
 * Everything here is a pure function over a list a caller already fetched, not
 * a hook. The reads are shared by TanStack Query, so a screen that needs two of
 * these pays for one request each and this module never issues one.
 */

import type {
  OperatorFolio,
  OperatorRoom,
  OperatorStay,
} from "@injishi/contracts";

/**
 * The stay a booking became, if anyone has arrived on it yet.
 *
 * Undefined is a real and common answer, not an error: a confirmed reservation
 * for next Tuesday has no stay, and a screen that treats undefined as a failure
 * would refuse to render a booking that is perfectly healthy.
 */
export function stayForBooking(
  stays: readonly OperatorStay[],
  bookingId: string | null | undefined,
): OperatorStay | undefined {
  if (!bookingId) return undefined;
  return stays.find((s) => s.bookingId === bookingId);
}

/**
 * The open stay in a room.
 *
 * Reads the occupancy the rooms endpoint already resolves rather than scanning
 * stays for a room id: `occupiedBy` is the server's own answer to "who is in
 * this room right now", and deriving a second one in the browser is how the two
 * come to disagree.
 */
export function stayIdForRoom(
  rooms: readonly OperatorRoom[],
  roomId: string | null | undefined,
): string | null {
  if (!roomId) return null;
  return rooms.find((r) => r.id === roomId)?.occupiedBy?.stayId ?? null;
}

/** The same join, by the label a guest and a receptionist both say out loud. */
export function stayIdForRoomLabel(
  rooms: readonly OperatorRoom[],
  label: string | null | undefined,
): string | null {
  if (!label) return null;
  return (
    rooms.find((r) => r.label === label)?.occupiedBy?.stayId ?? null
  );
}

/**
 * The bill a stay is running, if it has opened one.
 *
 * A stay with no folio is a real state and not an error — the bill opens with
 * the first charge, so a walk-in who has not been charged for anything yet has
 * a stay and no folio. `screens/stay.tsx` words exactly that case.
 */
export function folioForStay(
  folios: readonly OperatorFolio[],
  stayId: string | null | undefined,
): OperatorFolio | undefined {
  if (!stayId) return undefined;
  return folios.find((f) => f.guestStayId === stayId);
}

/**
 * What this stay owes, or null when there is nothing to say yet.
 *
 * Null rather than zero, and the difference matters on a badge: zero is
 * "settled", null is "we do not know". A stay whose folio has not opened, or
 * whose folio read has not answered, must not be painted as a guest who has
 * paid — that is the number a receptionist waves somebody out of the door on.
 */
export function balanceForStay(
  folios: readonly OperatorFolio[],
  stayId: string | null | undefined,
): number | null {
  return folioForStay(folios, stayId)?.balanceRwf ?? null;
}

/**
 * The address of a stay's bill, or null when there is no stay to address.
 *
 * Returning null rather than a best-effort path is the point of the module. A
 * caller cannot accidentally build the old broken URL, because there is no id
 * to build it out of — the type says so, and the call sites branch on it to
 * decide whether to offer the button at all.
 */
export function folioPathForStay(stayId: string | null | undefined): string | null {
  return stayId ? `/stays/${stayId}/folio` : null;
}
