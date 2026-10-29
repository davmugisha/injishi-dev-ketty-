"use client";

import { useState } from "react";
import type { BookingCancellationResult, CancellationQuote } from "@injishi/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@injishi/web-ui";
import { formatPrice } from "@injishi/utils";
import { Icon } from "@/components/app/icon";
import {
  cancelBooking,
  cancellationProblem,
  fetchCancellationQuote,
  refundHeadline,
} from "@/data/cancellation";

/**
 * Cancel one of the guest's own bookings: quote first, then confirm.
 *
 * THE QUOTE IS ASKED FOR WHEN THE DIALOG OPENS, NOT BEFORE. It is a read against
 * the clock (the tier depends on hours before check-in), so a figure fetched
 * when the trips list loaded could be a day stale by the time somebody presses
 * the button. Opening the dialog is the moment the guest is deciding.
 *
 * THE FIGURES ARE THE SERVER'S. The refund, the forfeit and the `rule` sentence
 * are printed as `GET …/cancellation` returned them; the confirmation then
 * prints what `POST …/cancel` actually refunded, which is the same function over
 * the same locked values, and is what the guest is owed.
 *
 * A quote that says `cancellable: false` shows its `refusal` and offers no
 * confirm button. A refusal on the POST (409 already cancelled, checked in,
 * payment settled; 503 refund not confirmed) is shown in the API's own words,
 * and the dialog stays open so the guest reads it.
 */
export function CancelBooking({
  reference,
  onCancelled,
  size = "sm",
}: {
  reference: string;
  /**
   * Called once the booking is cancelled and the guest has closed the dialog,
   * so the caller can refresh its list. Not before: a caller that reloads
   * unmounts this dialog, and the guest would lose the refund they were reading.
   */
  onCancelled?: (result: BookingCancellationResult) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BookingCancellationResult | null>(null);

  const loadQuote = async () => {
    setQuote(null);
    setProblem(null);
    const result = await fetchCancellationQuote(reference);
    if (result.status === "ok") setQuote(result.data);
    else setProblem(cancellationProblem(result, "quote"));
  };

  const openDialog = () => {
    setDone(null);
    setOpen(true);
    void loadQuote();
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await cancelBooking(reference);
    setBusy(false);
    if (result.status === "ok") {
      setDone(result.data);
      return;
    }
    setProblem(cancellationProblem(result, "cancel"));
  };

  const loading = quote === null && problem === null && done === null;

  const changeOpen = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    if (!next && done) onCancelled?.(done);
  };

  return (
    <>
      <Button size={size} variant="ghost" onClick={openDialog}>
        Cancel booking
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {done ? "Booking cancelled" : "Cancel this booking?"}
            </DialogTitle>
            <DialogDescription>
              <span className="money">Reference {reference}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            {loading ? (
              <>
                <span className="sr-only" role="status">
                  Working out your refund
                </span>
                <Skeleton className="h-6 w-1/2 rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </>
            ) : null}

            {done ? (
              <>
                <p className="money font-display text-2xl font-bold">
                  {formatPrice(done.refundRwf)}
                </p>
                <p className="text-sm text-muted-foreground">{done.rule}</p>
                {done.refundRwf > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    The refund goes back to the number you paid from, once the
                    bank sends it. Follow it under{" "}
                    <a href="/account/refunds" className="font-semibold underline">
                      Refunds
                    </a>
                    . Your trips list now shows this stay as cancelled.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your trips list now shows this stay as cancelled.
                  </p>
                )}
              </>
            ) : null}

            {!done && quote ? (
              quote.cancellable ? (
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                      {refundHeadline(quote)}
                    </dt>
                    <dd className="money mt-1 font-display text-2xl font-bold">
                      {formatPrice(quote.refundRwf)}
                    </dd>
                  </div>
                  {quote.forfeitRwf > 0 ? (
                    <div>
                      <dt className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                        Not refunded
                      </dt>
                      <dd className="money mt-1 text-sm">{formatPrice(quote.forfeitRwf)}</dd>
                    </div>
                  ) : null}
                  <p className="text-sm text-muted-foreground">{quote.rule}</p>
                </dl>
              ) : (
                <p className="text-sm">
                  {quote.refusal ?? "This booking can no longer be cancelled here."}
                </p>
              )
            ) : null}

            {problem ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <Icon name="triangle-alert" className="mt-0.5 size-4 shrink-0" />
                <span>{problem}</span>
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            {done ? (
              <Button onClick={() => changeOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
                  Keep booking
                </Button>
                {quote === null && problem !== null ? (
                  <Button variant="outline" onClick={() => void loadQuote()}>
                    Try again
                  </Button>
                ) : null}
                {quote?.cancellable ? (
                  <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
                    {busy
                      ? "Cancelling…"
                      : quote.refundRwf > 0
                        ? `Cancel and refund ${formatPrice(quote.refundRwf)}`
                        : "Cancel without refund"}
                  </Button>
                ) : null}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
