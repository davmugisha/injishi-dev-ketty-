"use client";

/**
 * "Decline and refund", asked once in a dialog.
 *
 * On Today a decline is a `ConfirmAction` beside Approve: two presses, in
 * place. On Reservations it lives in the row's "more" menu (2026-10-06), and a
 * menu item cannot ask twice in place — the menu closes on the first press. So
 * it asks here instead, in the same words: the request closes and the guest's
 * money goes back, and nothing on this screen undoes it.
 *
 * It stays open while the decline is in flight and closes when the answer
 * lands, so the outcome arrives with something on screen to explain it, the
 * rule the host cancel dialog keeps for the same reason.
 */

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@injishi/ui";

import { ActionButton } from "../ui";

export function DeclineDialog({
  open,
  onOpenChange,
  guest,
  reference,
  dates,
  pending,
  onConfirm,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: string;
  reference: string;
  dates: string;
  pending: boolean;
  onConfirm: () => void;
  /** Focus goes back to the menu trigger that opened this, not to the body. */
  onClosed?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="border-panel-bd bg-panel sm:max-w-narrow"
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
          <DialogTitle className="pms-display text-lg font-bold text-ink">Decline {guest}&apos;s request?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {reference}, {dates}. The request closes and the guest&apos;s money goes back to them. Nothing on
            this screen can undo it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <ActionButton onClick={() => onOpenChange(false)} disabled={pending}>
            Keep the request
          </ActionButton>
          <Button type="button" variant="danger" size="sm" shape="rounded" pending={pending} onClick={onConfirm}>
            {pending ? "Declining" : "Yes, decline and refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
