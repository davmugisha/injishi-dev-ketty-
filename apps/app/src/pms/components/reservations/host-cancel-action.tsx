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
 *    it the control stays, disabled, with the refusal `reasonFor` words, and the
 *    dialog never opens, so the command cannot fire into a 403.
 *  - A refusal is the API's own sentence, in a toast, through `toastError`.
 *
 * **TWO WAYS IN, ONE DIALOG (2026-10-06).** Reservations moved every row's
 * secondary actions into a "more" menu, and cancelling is one of them, so the
 * logic is `useHostCancel` and the trigger is the caller's: a menu item there,
 * the `HostCancelAction` button anywhere a button still belongs. Both open the
 * same dialog with the same gate and the same sentences.
 */

import { useState, type ReactNode } from "react";
import type { OperatorReservation } from "@injishi/contracts";
import { CalendarX } from "lucide-react";
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

/** The icon a cancellation wears, in the menu and on the button alike. */
export const HOST_CANCEL_ICON = CalendarX;

export interface HostCancel {
  /** Whether this booking can be cancelled by the property at all. */
  offered: boolean;
  /** Why the caller may not, or undefined when they may. */
  deniedReason: string | undefined;
  /** This booking's cancellation is in flight. */
  pending: boolean;
  /** Open the dialog. Does nothing when not offered or refused. */
  open: () => void;
  /** The dialog, to be rendered once beside whatever opens it. */
  dialog: ReactNode;
}

/**
 * Everything a cancel control needs, without the control.
 *
 * `onClosed` runs once the dialog has shut by any route — kept, cancelled or
 * refused — so a caller that opened it from a menu can put focus back on the
 * menu's trigger rather than leaving it on the page body.
 */
export function useHostCancel(
  reservation: HostCancelReservation | undefined,
  onClosed?: () => void,
): HostCancel {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();
  const cancel = useHostCancelBooking(workspaceId);
  const [isOpen, setOpen] = useState(false);

  const offered = Boolean(reservation && workspaceId !== null && isHostCancellable(reservation, todayIso()));
  const deniedReason = can("reservation.approve") ? undefined : reasonFor("reservation.approve");
  const pending = Boolean(reservation) && cancel.isPending && cancel.variables === reservation?.id;
  const guest = reservation?.guestName ?? "The guest";

  function close() {
    setOpen(false);
  }

  function confirm() {
    if (!reservation || deniedReason || cancel.isPending) return;
    const { id, reference } = reservation;
    cancel.mutate(id, {
      onSuccess: (result) => {
        close();
        toast(
          result.refundRwf > 0
            ? `${reference} cancelled. ${guest} is refunded ${fmt(result.refundRwf)} in full.`
            : `${reference} cancelled. Nothing had been paid, so there was nothing to refund.`,
          "info",
        );
      },
      onError: (error) => {
        close();
        toastError(error);
      },
    });
  }

  const dialog =
    offered && reservation ? (
      /* It cannot be dismissed while the cancellation is in flight: the
         refund's outcome must arrive with something on screen to explain it. */
      <Dialog open={isOpen} onOpenChange={(next) => !next && !cancel.isPending && close()}>
        <DialogContent
          className="border-panel-bd bg-panel sm:max-w-narrow"
          // Focus goes back where the caller says, not to a menu item that no
          // longer exists. Run on the dialog's own close, after its focus trap
          // lets go, so the trigger keeps the focus it is given.
          onCloseAutoFocus={
            onClosed
              ? (e) => {
                  e.preventDefault();
                  onClosed();
                }
              : undefined
          }
        >
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
            <ActionButton onClick={close} disabled={cancel.isPending}>
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
    ) : null;

  return {
    offered,
    deniedReason,
    pending,
    open: () => {
      if (offered && !deniedReason) setOpen(true);
    },
    dialog,
  };
}

export function HostCancelAction({
  reservation,
}: {
  /** The desk's row from `GET /ops/reservations`. Undefined renders nothing. */
  reservation: HostCancelReservation | undefined;
}) {
  const c = useHostCancel(reservation);
  if (!c.offered) return null;

  return (
    <>
      <ActionButton
        onClick={c.open}
        deniedReason={c.deniedReason}
        pending={c.pending}
        icon={HOST_CANCEL_ICON}
        style={{ minWidth: 96 }}
      >
        {c.pending ? "Cancelling" : "Cancel booking"}
      </ActionButton>
      {c.dialog}
    </>
  );
}
