"use client";

import { ArrowRight, CircleCheck, Landmark } from "lucide-react";
import { Button, Checkbox } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { Callout } from "./register-shell";
import { formatRwf } from "./wizard-ui";

/**
 * Step 5, Pay (ADR-075 S7).
 *
 * The first press of Pay creates the registration from the answers (D-l), with
 * an \`Idempotency-Key\` minted once for that press, so a double press, a retry
 * or a second tab land on one registration (AC-14); then it pays. The press
 * needs one checkbox: the fee is not refundable.
 *
 * The payment itself is the API's stand in, \`POST /registrations/:id/pay\`: it
 * records the fee and sends the registration to PSF review, and no money moves.
 * The mobile money request to pay (ADR-073's GTBank child, D-k) replaces it in a
 * later slice; until then this screen says plainly that nothing is charged.
 */
export function StepPay({
  kindLabel,
  fee,
  paid,
  paidOn,
  understood,
  onUnderstood,
  demo,
  onSeeStatus,
}: {
  kindLabel: string;
  fee: number | null;
  paid: boolean;
  /** When the fee was recorded, as a person reads it, once it is. */
  paidOn: string | null;
  /** "I understand the registration fee is not refundable." */
  understood: boolean;
  onUnderstood: (next: boolean) => void;
  /** The API is the demo: the payment note says so. */
  demo: boolean;
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
          {paid ? "Paid" : "Not paid"}
        </span>
      </div>

      {paid ? (
        <>
          <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title="Paid. PSF reviews it next">
            {paidOn ? `The fee was recorded on ${paidOn}. ` : ""}We email you when PSF has decided.
          </Callout>
          <div>
            <Button onClick={onSeeStatus}>
              See where it stands
              <ArrowRight size={16} aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Checkbox
            isSelected={understood}
            onChange={(on: boolean) => onUnderstood(on)}
            className="items-start gap-3"
            controlClassName="mt-0.5"
          >
            <span className="text-sm">I understand the registration fee is not refundable.</span>
          </Checkbox>
          <Callout tone="info" icon={<Landmark size={16} aria-hidden />} title={demo ? "Demo payment, no money moves" : "No money moves yet"}>
            Pressing Pay records the fee against this registration and sends it to PSF for review.
          </Callout>
        </>
      )}
    </>
  );
}
