/**
 * Turning a record into the four facts the check-in drawer needs.
 *
 * Two sources, two functions, ONE seed type — and the reason they are separate
 * functions rather than one that sniffs its argument is that they disagree
 * about the room, which is the field that decides whether a submit succeeds.
 *
 * This module is also where the demo store's dependency on the drawer is
 * cornered. `ui-store.tsx` used to take a demo `Reservation` directly, which
 * made a fixture type a structural requirement of the live check-in path. It
 * takes `CheckInSeed` now, and the day `data/demo.ts` goes, this file goes with
 * it and nothing else has to change.
 */

import type { CheckInSeed } from "../ui-store";
import type { Reservation } from "../data/types";

/** The shape `GET /api/v1/ops/reservations` returns, narrowed to what we read. */
interface ServerReservation {
  id: string;
  guestName: string | null;
  nights: number;
  reference?: string;
  roomTypeId?: string;
}

/**
 * A reservation the server returned.
 *
 * No room is sent on purpose. The reservation's `room` is a LABEL ("101") and
 * the drawer submits a room UUID, so the receptionist picks from the live free
 * room list instead — which is also the only list that knows whether the room
 * is still free at the moment the guest actually walks up.
 */
export function seedFromServerReservation(r: ServerReservation): CheckInSeed {
  return {
    reservationId: r.id,
    // An account can exist before a name does. Empty rather than invented: the
    // drawer requires a name, so it stops at the field instead of checking a
    // guest in as "Guest".
    guestName: r.guestName ?? "",
    nights: r.nights,
    reference: r.reference,
    roomTypeId: r.roomTypeId,
  };
}

/**
 * A row from the standalone demo store.
 *
 * `walkin` is what makes the seed carry a null reservation id: the drawer picks
 * `POST /ops/stays/walk-in` over `POST /ops/stays/:bookingId/checkin` from
 * exactly that, and a demo walk-in has no booking behind it.
 *
 * The demo room is dropped for a harder reason than the server one. Its `room`
 * is a label from a fixture, so it matches nothing in `GET /ops/rooms` — but it
 * is a non-empty string, which used to satisfy the drawer's "a room is chosen"
 * check and let a receptionist submit a room id the server has never seen. An
 * empty room fails that check honestly, at the form, before the command.
 */
export function seedFromDemoReservation(r: Reservation): CheckInSeed {
  return {
    reservationId: r.walkin ? null : r.id,
    guestName: r.guest,
    nights: r.nights,
  };
}
