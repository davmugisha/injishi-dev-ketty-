"use client";

/**
 * The client for `POST /api/v1/bookings/:id/host-cancel` (F-B11, ADR-051).
 *
 * The property cancels a booking. What the route does, as read from
 * `BookingCancellationService.cancelByHost` rather than assumed:
 *
 *   - `SessionGuard` then `WorkspaceGuard`, declaring `reservation.approve`, the
 *     same permission approve and decline declare. A booking outside the named
 *     workspace is a 404, never a 403.
 *   - No body. There is no reason field on the contract, so this sends none.
 *   - ALWAYS a full refund (`cancellationRefund` with `party: "host"` is 100%).
 *     The escrow is released to the guest first; if the payment service does not
 *     confirm, nothing is recorded, the booking stands, and the answer is a 503.
 *   - Refused with a 409 when the booking is not pending or confirmed, when the
 *     guest has checked in, when the stay has ended, or when its escrow is no
 *     longer held.
 *   - It answers `BookingCancellationResult`, not the reservation row, so the
 *     desk list is patched by id and then refetched.
 *
 * Nothing here decides a permission. `useCapability` gates the button;
 * `WorkspaceGuard` is the control.
 */

import {
  BookingCancellationResult,
  type OperatorReservation,
  type OperatorReservationList,
} from "@injishi/contracts";
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { command } from "./api";
import { queryKeys } from "./queries";

/** The fields the host-cancellable decision reads. All of them are on the desk row. */
export type HostCancellable = Pick<OperatorReservation, "state" | "bookingStatus" | "checkOut">;

/**
 * May the property cancel this booking now? The client's copy of `refusalFor`
 * in `booking-cancellation.service.ts`, limited to what the desk row carries.
 *
 * - the raw booking is `pending_approval` or `confirmed`;
 * - nobody has checked in (the desk derives `inhouse` and `checked_out` from a
 *   stay, and the service refuses any booking with a stay);
 * - the stay has not ended: check-out is after today, in Kigali, `YYYY-MM-DD`
 *   compared as strings exactly as the service compares them.
 *
 * The one refusal it cannot see is an escrow that is no longer held, because the
 * row does not carry it. The server says so, and the refusal is shown as a toast.
 * This decides whether to OFFER the action; it never authorises it.
 */
export function isHostCancellable(reservation: HostCancellable, today: string): boolean {
  if (reservation.bookingStatus !== "confirmed" && reservation.bookingStatus !== "pending_approval") {
    return false;
  }
  if (reservation.state !== "pending" && reservation.state !== "confirmed") return false;
  return reservation.checkOut > today;
}

/**
 * Cancel a booking as the property. Fires only when called: a mutation, never a
 * query, so mounting it asks the server nothing.
 */
export function useHostCancelBooking(
  workspaceId: string | null,
): UseMutationResult<BookingCancellationResult, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const body = await command<unknown>(`/bookings/${bookingId}/host-cancel`, {
        workspaceId: workspaceId as string,
      });
      // Parsed against the contract, so a drift fails here, loudly, rather than
      // as a refund figure nobody can trace.
      return BookingCancellationResult.parse(body);
    },
    onSuccess: (result) => {
      // Patch the row at once so the badge reads Cancelled and the button goes,
      // then refetch for anything else that moved.
      client.setQueryData<OperatorReservationList>(
        queryKeys.reservations(workspaceId),
        (current) =>
          current
            ? {
                reservations: current.reservations.map((r) =>
                  r.id === result.id
                    ? { ...r, state: "cancelled", bookingStatus: result.status }
                    : r,
                ),
              }
            : current,
      );
      void client.invalidateQueries({ queryKey: queryKeys.reservations(workspaceId) });
      // The record page's Payment lens reads the booking's bill from here.
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}
