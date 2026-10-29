"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@injishi/web-ui";
import { CancelBooking } from "@/components/app/cancel-booking";

/**
 * The cancel action under a receipt.
 *
 * A receipt is where a guest lands from a confirmation email, so it is the
 * other place they look for "cancel". The dialog asks the API for the quote
 * when it opens; this panel does not read the booking itself, so it never
 * claims a stay is cancellable. A booking that is not (already cancelled,
 * checked in, over) is answered by the quote's own refusal.
 *
 * `print:hidden`, because the receipt prints and this is not part of it.
 */
export function ReceiptCancel({ reference }: { reference: string }) {
  const [cancelled, setCancelled] = useState(false);

  return (
    <section className="mx-auto mb-8 flex w-full max-w-read flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-inset print:hidden">
      {cancelled ? (
        <>
          <p className="text-sm text-muted-foreground">
            This booking is cancelled. Your trips list shows it with the refund.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/trips">See my trips</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Plans changed? See what cancelling refunds before you decide.
          </p>
          <CancelBooking reference={reference} onCancelled={() => setCancelled(true)} />
        </>
      )}
    </section>
  );
}
