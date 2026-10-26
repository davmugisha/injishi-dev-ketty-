"use client";

import { ArrowRight, CircleCheck, Landmark } from "lucide-react";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { Callout } from "./register-shell";
import { formatRwf } from "./wizard-ui";

/**
 * Step 6, Pay (Register.dc.html).
 *
 * THE ARTBOARD'S BANK TRANSFER IS NOT BUILT, and this screen says so rather
 * than printing an account number. The artboard checks the paying account's
 * name with a bank, gives a transfer reference, and waits for the transfer
 * (waiting, held for a check, paid). None of that has an endpoint, and the
 * artboard itself leaves the collection account, its number and its SWIFT code
 * as placeholders: a decision for the owner, recorded in progress-tracker.md.
 *
 * What the API has is `POST /registrations/:id/pay`, the stand-in for the
 * payment provider (F-S08): it records the fee as paid and sends the
 * registration for review, and no money moves. The step's primary action, in
 * the wizard, is that call.
 */
export function StepPay({
  kindLabel,
  fee,
  paid,
  paidOn,
  onSeeStatus,
}: {
  kindLabel: string;
  fee: number | null;
  paid: boolean;
  /** When the fee was recorded, as a person reads it, once it is. */
  paidOn: string | null;
  onSeeStatus: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-secondary px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">Registration fee for a {kindLabel}</span>
          <span className="text-2xl font-semibold tabular-nums">{fee === null ? "Not available yet" : formatRwf(fee)}</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            paid ? "bg-success/15 text-success" : "bg-card text-muted-foreground",
          )}
        >
          {paid ? "Paid" : "Not paid yet"}
        </span>
      </div>

      {paid ? (
        <>
          <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title="Paid. Your registration is with Injishi for review">
            {paidOn ? `The fee was recorded on ${paidOn}. ` : ""}An officer reviews it next, and we email you either way.
          </Callout>
          <div>
            <Button onClick={onSeeStatus}>
              See where it stands
              <ArrowRight size={16} aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <Callout tone="info" icon={<Landmark size={16} aria-hidden />} title="Bank transfer is not connected yet">
          Injishi&apos;s payment provider is not connected, so no transfer details are shown and no money moves. Pressing
          Pay records the fee against this registration and sends it to Injishi for review.
        </Callout>
      )}
    </>
  );
}
