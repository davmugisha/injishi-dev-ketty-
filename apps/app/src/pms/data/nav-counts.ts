"use client";

import type { OperatorReservationList, OperatorRoomList } from "@injishi/contracts";

import type { NavCounts } from "../lib/nav";
import { todayIso } from "../lib/format";
import { useRooms } from "./ops";
import { useReservations } from "./reservations";

/**
 * The sidebar's count pills, from reads the desk already makes (2026-10-06).
 *
 * A pill shows a number a live query counted or nothing at all (ADR-035, D-a).
 * Three pills have that query, and it is one the operator's own screens already
 * send: the Dashboard and Reservations read `GET /ops/reservations`, the
 * Dashboard and Room status read `GET /ops/rooms`. These are the same hooks
 * with the same query keys, so the sidebar shares their cache rather than
 * adding a request per screen, and a decision, a check in or a cleaned room
 * moves the pill the moment the mutation's own invalidation refetches the list.
 *
 *  - Reservations: requests waiting for a decision (`state === "pending"`).
 *  - Front desk: confirmed bookings arriving today that nobody has checked in
 *    yet, exactly the Dashboard's "arriving" group (a checked in guest is
 *    `inhouse`, no longer `confirmed`). The Sidebar board's "arrivals still to
 *    check in".
 *  - Housekeeping: rooms marked as needing a clean (`housekeeping === "dirty"`).
 *
 * Each hook gates itself on the read's own permissions (`OPS_READ`), so a
 * grant that may not read a list sends nothing and its pill stays absent, never
 * a zero it did not count. Whose work a pill names is `navFor`'s call (the
 * accountant reads bookings and decides none, so their Reservations is quiet).
 *
 * Services (open orders) and Messages (unread) have no pill: the orders list is
 * read only by its own screen, and reading it on every screen to light a pill
 * is a cost this does not take; the operator inbox has no unread state at all.
 * A board badge with no count behind it is not drawn.
 */
export function useNavCounts(workspaceId: string | null): NavCounts {
  const reservations = useReservations(workspaceId);
  const rooms = useRooms(workspaceId);
  return navCountsFrom(reservations.data, rooms.data, todayIso());
}

/**
 * The counting, apart from the reads. `undefined` data is an unanswered read:
 * no pill. `today` is the Kigali calendar day (`todayIso`), passed in so the
 * count is a function of what it is given.
 */
export function navCountsFrom(
  reservations: Pick<OperatorReservationList, "reservations"> | undefined,
  rooms: Pick<OperatorRoomList, "rooms"> | undefined,
  today: string,
): NavCounts {
  return {
    pendingReservations: reservations ? reservations.reservations.filter((r) => r.state === "pending").length : null,
    arrivalsToCheckIn: reservations
      ? reservations.reservations.filter((r) => r.state === "confirmed" && r.checkIn === today).length
      : null,
    housekeepingOpen: rooms ? rooms.rooms.filter((r) => r.housekeeping === "dirty").length : null,
  };
}
