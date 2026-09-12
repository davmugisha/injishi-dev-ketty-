"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@injishi/ui";
import { AirtelMark, CardMark, MtnMark } from "@/components/icons/marks";
import { describePaymentMethod, type PaymentDraft } from "@/lib/payment-methods";

const MARK = { mtn_momo: MtnMark, airtel_money: AirtelMark, card: CardMark } as const;

/**
 * Step 3. The consent sentence and one full-width button, worded by the
 * method the guest actually chose.
 *
 * "Google Pay" on the capture's button is what THAT method is called; here it
 * is the same idea run through `describePaymentMethod`, so an MTN booking
 * says `Pay with MTN MoMo` and a card booking still says the same
 * `Confirm and pay` / `Request to book` this checkout already used — see
 * `checkout.tsx`, which passes `payLabel` in rather than this step guessing
 * at booking mode it does not know.
 */
export function StepReview({
  draft,
  payLabel,
  pendingLabel,
  pending,
  onConfirm,
}: {
  draft: PaymentDraft;
  payLabel: string;
  /** What the button says while the booking is being made, in the guest's terms. */
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const Mark = MARK[draft.method];
  const slow = useSlowWait(pending);

  return (
    <div>
      <p className="text-sm text-page-fg-70">
        By selecting the button, I agree to the{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          booking terms
        </Link>{" "}
        and updated{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          Terms of Service
        </Link>
        . View{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>

      {/* `pending`, not `disabled`: the button a guest just pressed with their
          money on it must not look dead, and must not take a second press. */}
      <Button
        size="lg"
        className="mt-6 flex w-full items-center justify-center gap-2"
        onClick={onConfirm}
        pending={pending}
      >
        <Mark width={20} height={20} aria-hidden />
        {pending ? pendingLabel : payLabel}
      </Button>
      {/* A booking can take up to twelve seconds. Past a few, silence reads as
          "it froze", and a guest who thinks it froze reloads mid-payment. */}
      <p aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-page-fg-70">
        {slow ? "Still working on it. Keep this page open — you won't be charged twice." : ""}
      </p>
    </div>
  );
}

/** True once `active` has lasted longer than a person waits without wondering. */
function useSlowWait(active: boolean, afterMs = 4000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(timer);
  }, [active, afterMs]);
  return slow;
}
