"use client";

import { Button, Checkbox, Separator } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import {
  CheckoutChoice,
  CheckoutChoiceGroup,
  CheckoutDivider,
} from "@/components/book/checkout-choice";

/**
 * Step 1. How much this booking costs right now, and whether it costs less.
 *
 * The reference offers a second "Pay $0 now" row that defers the charge to a
 * later date. Nothing in `PaymentsModule` supports a deferred capture — the
 * seam takes one `capture` at booking time (F-S08, ADR-020) — so the row
 * stays, disabled, rather than being dropped: a guest should see the option
 * exists and is not yet offered, not wonder why this screen has one fewer
 * choice than the app they are used to.
 *
 * The non-refundable rate is not in any capture. It moved here from the old
 * checkout (ADR-014 AC-7): whether it exists at all is `nonrefundableEligible`
 * on the real room type, never assumed, and it is the one choice on this
 * screen that changes the total — which is exactly what "when to pay" is
 * asking about, so it belongs in this step rather than a fourth one.
 */
export function StepWhenToPay({
  totalRwf,
  nonRefundable,
  onToggleNonRefundable,
  nonrefundableEligible,
  onNext,
}: {
  totalRwf: number;
  nonRefundable: boolean;
  onToggleNonRefundable: (value: boolean) => void;
  nonrefundableEligible: boolean;
  onNext: () => void;
}) {
  return (
    <div>
      <CheckoutChoiceGroup legend="When to pay for this stay">
        <CheckoutChoice
          name="when-to-pay"
          value="now"
          checked
          onChange={() => {}}
          label={`Pay ${formatPrice(totalRwf)} now`}
        />
        <CheckoutDivider />
        {/*
          No `opacity-60` here any more. It multiplied with the row's own
          secondary copy and put the sentence explaining WHY this option is
          unavailable at 2.67:1 — the one line on the row a guest actually needs
          to read. `CheckoutChoice` now quietens a disabled row onto
          `text-muted-foreground`, which is measured.
        */}
        <CheckoutChoice
          name="when-to-pay"
          value="later"
          checked={false}
          disabled
          onChange={() => {}}
          label="Pay in instalments"
          description="Not offered yet on Injishi. The full total is captured into escrow when you confirm."
        />
      </CheckoutChoiceGroup>

      {nonrefundableEligible ? (
        <>
          <Separator className="my-4" />
          <Checkbox
            isSelected={nonRefundable}
            onChange={onToggleNonRefundable}
            className="flex cursor-pointer items-start gap-3 text-sm text-page-fg"
          >
            <span>
              Non-refundable rate
              <span className="block text-sm text-page-fg-70">
                10% cheaper. Full forfeit on cancellation, whatever the tier says.
              </span>
            </span>
          </Checkbox>
        </>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
