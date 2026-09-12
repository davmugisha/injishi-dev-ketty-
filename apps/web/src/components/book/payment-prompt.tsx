"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import type { PaymentAttemptStatus } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { AirtelMark, MtnMark } from "@/components/icons/marks";
import { fetchPaymentAttempt } from "@/data/bookings";

const MARK = { mtn_momo: MtnMark, airtel_money: AirtelMark } as const;
const LABEL = { mtn_momo: "MTN MoMo", airtel_money: "Airtel Money" } as const;

/**
 * Waiting for a payment that is sitting on the guest's own phone (ADR-047 D-j).
 *
 * ## What this replaces
 *
 * A 402 and this sentence: *"Approve the payment on your phone, then press
 * confirm again."* That is a person polling a payment provider by hand, at the
 * moment their money is in the air — and if they closed the tab there was
 * nothing anywhere that knew a charge was pending.
 *
 * Every Rwandan mobile money payment works this way, so this is not an edge
 * case. It is what almost every booking on this platform will look like.
 *
 * ## Three things this screen owes the guest
 *
 * **Say where to look.** The prompt is on a handset, not in this browser, and
 * the number is shown masked so they can check it is the right phone before
 * they go hunting for it.
 *
 * **Show that time is finite.** A spinner with no end is why people reload a
 * payment page. The countdown is the server's `expiresAt`, so the screen and
 * the sweep that voids the capture cannot disagree about when it is over.
 *
 * **Never claim success.** Only the server's answer moves this on. The polling
 * is invisible; the guest is told to approve on their phone, and the screen
 * changes by itself when it lands.
 */
export function PaymentPrompt({
  attempt,
  onSettled,
  onEnded,
}: {
  attempt: PaymentAttemptStatus;
  /** The money landed and there is a reservation. */
  onSettled: (settled: PaymentAttemptStatus) => void;
  /** It was refused or timed out. Nothing was charged. */
  onEnded: (ended: PaymentAttemptStatus) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(attempt.expiresAt));
  const [checking, setChecking] = useState(false);

  /*
   * The callbacks change identity on every render of the parent, and this
   * effect must NOT restart the poll when they do — a poll that resets its own
   * timer never fires. Kept in a ref so the effect depends on the token alone.
   */
  const settled = useRef(onSettled);
  const ended = useRef(onEnded);
  settled.current = onSettled;
  ended.current = onEnded;

  useEffect(() => {
    let stopped = false;

    /*
     * Every two seconds, and never faster.
     *
     * Each poll asks the API, which asks the payment provider. A tighter loop
     * would put a payment gateway under one guest's browser, and the route
     * keeps a per-person throttle for exactly that reason.
     */
    const tick = async () => {
      if (stopped) return;
      const result = await fetchPaymentAttempt(attempt.attemptToken);
      if (stopped || result.status !== "ok") return;

      const next = result.data;
      if (next.state === "confirmed") {
        stopped = true;
        settled.current(next);
      } else if (next.state === "refused" || next.state === "expired") {
        stopped = true;
        ended.current(next);
      }
    };

    const poll = setInterval(() => void tick(), 2_000);
    const clock = setInterval(() => {
      setSecondsLeft(remaining(attempt.expiresAt));
    }, 1_000);

    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [attempt.attemptToken, attempt.expiresAt]);

  const Mark = attempt.network ? MARK[attempt.network] : Smartphone;
  const label = attempt.network ? LABEL[attempt.network] : "your phone";

  const check = async () => {
    setChecking(true);
    const result = await fetchPaymentAttempt(attempt.attemptToken);
    setChecking(false);
    if (result.status !== "ok") return;
    if (result.data.state === "confirmed") onSettled(result.data);
    else if (result.data.state !== "prompting") onEnded(result.data);
  };

  return (
    <div className="rounded-card border border-input bg-card p-6 lg:p-8">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-secondary"
        >
          <Mark width={26} height={26} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-page-fg lg:text-xl">
            Check your phone
          </h2>
          <p className="mt-1 text-sm text-page-fg-70">
            We sent a {label} request
            {attempt.payerMasked ? ` to ${attempt.payerMasked}` : ""}
            {attempt.amountRwf !== null ? ` for ${formatPrice(attempt.amountRwf)}` : ""}.
            Approve it there and this page will move on by itself.
          </p>
        </div>
      </div>

      {/*
        `aria-live="polite"`, so the countdown reaches a screen reader without
        interrupting whatever it is in the middle of saying. It is the one thing
        on this screen that changes without the guest doing anything.
      */}
      <p aria-live="polite" className="mt-6 text-sm text-page-fg">
        {secondsLeft > 0 ? (
          <>
            Waiting for your approval —{" "}
            <b className="tabular-nums">{formatClock(secondsLeft)}</b> left.
          </>
        ) : (
          "That request has timed out. Nothing has been charged."
        )}
      </p>

      <p className="mt-2 text-xs text-page-fg-70">
        Nothing is taken until you approve it. If you dismissed the prompt by
        mistake, it will time out and you can start again — you will not be
        charged twice.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/*
          A manual check, for the guest who approved it and is watching a screen
          that has not caught up. It is a convenience, never the mechanism: the
          poll above is what actually moves this on, so a guest who does nothing
          still gets an answer.
        */}
        <Button variant="outline" onClick={() => void check()} pending={checking}>
          {checking ? "Checking…" : "I've approved it"}
        </Button>
        <span className="text-xs text-page-fg-70">
          Keep this page open.
        </span>
      </div>
    </div>
  );
}

/** Whole seconds until `iso`, never negative. */
function remaining(iso: string): number {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
}

/** `95` → `1:35`. */
function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
