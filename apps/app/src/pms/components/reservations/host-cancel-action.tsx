"use client";

/**
 * The property cancels a booking (F-B11, ADR-051): `POST /bookings/:id/host-cancel`.
 *
 * A DIALOG, unlike the inline `ConfirmAction` that guards a decline. A decline
 * answers a request the guest is waiting on; this withdraws a stay the guest
 * already holds, is always a full refund, and is rare enough that a sentence
 * explaining it costs the desk nothing.
 *
 * Three rules, each one the app's standing pattern:
 *
 *  - Offered only when the booking is in a state the service cancels
 *    (`isHostCancellable`), and only on a live row: with no workspace there is
 *    no server to ask, so it renders nothing.
 *  - Gated on `reservation.approve`, the permission the route declares. Without
 *    it the button stays, disabled, with the refusal `reasonFor` words, and the
 *    dialog never opens, so the command cannot fire into a 403.
 *  - A refusal is the API's own sentence, in a toast, through `toastError`.
 */

import { useState } from "react";
import type { OperatorReservation } from "@injishi/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@injishi/ui";

import { useCapability, useWorkspaceId } from "../../data/capability";
import { isHostCancellable, useHostCancelBooking } from "../../data/host-cancel";
import { dateRangeIso, fmt, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { ActionButton } from "../ui";

export type HostCancelReservation = Pick<
  OperatorReservation,
  "id" | "reference" | "guestName" | "checkIn" | "checkOut" | "state" | "bookingStatus" | "totalRwf"
>;

export function HostCancelAction({
  reservation,
}: {
  /** The desk's row from `GET /ops/reservations`. Undefined renders nothing. */
  reservation: HostCancelReservation | undefined;
}) {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();
  const cancel = useHostCancelBooking(workspaceId);
  const [open, setOpen] = useState(false);

  if (!reservation || workspaceId === null) return null;
  if (!isHostCancellable(reservation, todayIso())) return null;

  const deniedReason = can("reservation.approve") ? undefined : reasonFor("reservation.approve");
  const pending = cancel.isPending && cancel.variables === reservation.id;
  const guest = reservation.guestName ?? "The guest";

  function confirm() {
    // Both checks again at the moment of the call, not only at render: the
    // capability may have been refreshed away while the dialog was open.
    if (!reservation || deniedReason || cancel.isPending) return;
    const { id, reference } = reservation;
    cancel.mutate(id, {
      onSuccess: (result) => {
        setOpen(false);
        toast(
          result.refundRwf > 0
            ? `${reference} cancelled. ${guest} is refunded ${fmt(result.refundRwf)} in full.`
            : `${reference} cancelled. Nothing had been paid, so there was nothing to refund.`,
          "info",
        );
      },
      onError: (error) => {
        setOpen(false);
        toastError(error);
      },
    });
  }

  return (
    <>
      <ActionButton
        onClick={() => setOpen(true)}
        deniedReason={deniedReason}
        pending={pending}
        style={{ minWidth: 96 }}
      >
        {pending ? "Cancelling" : "Cancel booking"}
      </ActionButton>

      {/* It cannot be dismissed while the cancellation is in flight: the
          refund's outcome must arrive with something on screen to explain it. */}
      <Dialog open={open} onOpenChange={(next) => !next && !cancel.isPending && setOpen(false)}>
        <DialogContent className="border-panel-bd bg-panel sm:max-w-narrow">
          <DialogHeader>
            <DialogTitle className="pms-display text-lg font-bold text-ink">
              Cancel {reservation.reference}?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {guest}&apos;s stay, {dateRangeIso(reservation.checkIn, reservation.checkOut)}, is
              cancelled for good. Because the property is cancelling, the guest is refunded in
              full, whatever the booking&apos;s cancellation policy says, and both of you are
              notified.
              {reservation.totalRwf !== null ? ` The booking is worth ${fmt(reservation.totalRwf)}.` : ""}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            If the payment service cannot confirm the refund, nothing changes and the booking
            stays as it is. A bill already opened on this booking is not closed by this.
          </p>

          <DialogFooter>
            <ActionButton onClick={() => setOpen(false)} disabled={cancel.isPending}>
              Keep the booking
            </ActionButton>
            <Button
              type="button"
              variant="danger"
              size="sm"
              shape="rounded"
              pending={cancel.isPending}
              onClick={confirm}
            >
              {cancel.isPending ? "Cancelling and refunding" : "Cancel and refund in full"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
