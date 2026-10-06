"use client";

import type { OperatorReservationList, OperatorRoomList } from "@injishi/contracts";

import type { NavCounts } from "../lib/nav";
import { useRooms } from "./ops";
import { useReservations } from "./reservations";

/**
 * The sidebar's count pills, from reads the desk already makes (2026-10-06).
 *
 * `navContextOf` has always left `counts` undefined, on the rule that a pill
 * shows a number a live query counted or nothing at all (ADR-035, D-a). Two of
 * the pills now have that query, and it is one the operator's own screens
 * already send: Today and Reservations read `GET /ops/reservations`, Today and
 * Room status read `GET /ops/rooms`. These are the same hooks with the same
 * query keys, so the sidebar shares their cache rather than adding a request
 * per screen, and a decision or a cleaned room moves the pill the moment the
 * mutation's own invalidation refetches the list.
 *
 *  - Reservations: requests waiting for a decision (`state === "pending"`).
 *  - Housekeeping: rooms marked as needing a clean (`housekeeping === "dirty"`).
 *
 * Each hook gates itself on the read's own permissions (`OPS_READ`), so a
 * grant that may not read a list sends nothing and its pill stays absent, never
 * a zero it did not count. The other three pills (tickets, live orders, unread
 * threads) stay absent: their lists are read only by their own screens, and
 * reading each on every screen to light a pill is a cost this does not take.
 */
export function useNavCounts(workspaceId: string | null): NavCounts {
  const reservations = useReservations(workspaceId);
  const rooms = useRooms(workspaceId);
  return navCountsFrom(reservations.data, rooms.data);
}

/** The counting, apart from the reads. `undefined` data is an unanswered read: no pill. */
export function navCountsFrom(
  reservations: Pick<OperatorReservationList, "reservations"> | undefined,
  rooms: Pick<OperatorRoomList, "rooms"> | undefined,
): NavCounts {
  return {
    pendingReservations: reservations ? reservations.reservations.filter((r) => r.state === "pending").length : null,
    housekeepingOpen: rooms ? rooms.rooms.filter((r) => r.housekeeping === "dirty").length : null,
  };
}
