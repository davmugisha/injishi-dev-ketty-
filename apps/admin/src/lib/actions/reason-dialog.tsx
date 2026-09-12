"use client";

import { Button, NativeDialog, Textarea } from "@injishi/ui";
import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * The dialog every console write opens first: it asks why.
 *
 * Every admin write route requires a written `reason` and records it on the
 * `audit_events` row it commits with the change. A button that wrote without
 * asking would have to invent one, and a trail of invented reasons cannot
 * answer the only question it is ever asked — why was this done.
 *
 * It lives beside the actions because it is their front half: one dialog, so
 * the reason is asked for the same way, with the same 4 to 500 character
 * bounds the contract enforces, whichever button opened it.
 *
 * `onConfirm` resolves `true` to close and `false` to stay open. A write whose
 * input was refused keeps the dialog open so the staffer can fix the reason
 * without retyping it; every other outcome closes it and the toast says what
 * happened.
 *
 * A `danger` confirm says so in shape as well as colour: the heading carries a
 * warning icon, and each caller's confirm label names the act ("End all
 * sessions", not "OK"), so the weight survives a colour-blind eye or a
 * high-contrast theme.
 */
export function ReasonDialog({
  open,
  title,
  body,
  confirmLabel,
  pendingLabel = "Waiting for the platform…",
  tone = "default",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** What the confirm says while the write is out, worded for the wait. */
  pendingLabel?: string;
  tone?: "default" | "danger";
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <NativeDialog
      open={open}
      // Closing mid-request would let the staffer believe the write was
      // abandoned; it is still in flight, so the dialog waits for its answer.
      // `dismissible` covers Escape and the backdrop, which the browser would
      // otherwise honour on its own.
      dismissible={!pending}
      onClose={() => {
        if (!pending) onClose();
      }}
      ariaLabel={title}
    >
      <form
        className="p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const reason = String(new FormData(form).get("reason") ?? "");
          setPending(true);
          try {
            if (await onConfirm(reason)) {
              form.reset();
              onClose();
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="flex items-start gap-2 font-display text-2xl font-bold">
          {tone === "danger" ? (
            <TriangleAlert className="mt-1.5 size-5 shrink-0 text-destructive" aria-hidden />
          ) : null}
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">
            Reason — recorded on the audit trail with your name
          </span>
          <Textarea
            name="reason"
            required
            minLength={4}
            maxLength={500}
            rows={3}
            className="mt-1"
            readOnly={pending}
            placeholder="What you observed, and why this action is the proportionate one"
          />
        </label>
        <div className="mt-5 flex gap-2">
          {/* `pending`, not `disabled`: focus stays on the button just pressed,
              a second press is refused, and the shimmer says it registered. */}
          <Button
            type="submit"
            variant={tone === "danger" ? "danger" : "primary"}
            className="grow"
            pending={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
          <Button variant="outline" className="grow" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </NativeDialog>
  );
}
