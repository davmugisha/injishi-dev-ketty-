"use client";

import { Fragment, useState } from "react";
import { Button } from "@injishi/web-ui";
import { AirtelMark, CardMark, MtnMark } from "@/components/icons/marks";
import {
  CheckoutChoice,
  CheckoutChoiceGroup,
  CheckoutDivider,
} from "@/components/book/checkout-choice";
import { CheckoutFieldGroup } from "@/components/book/checkout-field";
import { PaymentMobileMoneyForm } from "@/components/book/payment-mobile-money-form";
import {
  PAYMENT_METHODS,
  paymentDraftProblem,
  type PaymentDraft,
  type PaymentMethodId,
} from "@/lib/payment-methods";

const ROW_MARK: Record<PaymentMethodId, typeof MtnMark> = {
  mtn_momo: MtnMark,
  airtel_money: AirtelMark,
  card: CardMark,
};

/**
 * Step 2. The method list, in `PAYMENT_METHODS` order, MTN MoMo and Airtel
 * Money before card, with the chosen method's own form open beneath it.
 *
 * `showErrors` only turns on after a guest presses Next once, matching the
 * rest of the app's rule of never greying out the primary action (see
 * `booking-widget.tsx`): the button stays live and pressing it is what
 * surfaces what is still missing, rather than the guest hunting for why a
 * disabled button will not move.
 */
export function StepPaymentMethod({
  draft,
  onChange,
  onNext,
}: {
  draft: PaymentDraft;
  onChange: (draft: PaymentDraft) => void;
  onNext: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const problem = paymentDraftProblem(draft);

  const handleNext = () => {
    if (problem) {
      setAttempted(true);
      return;
    }
    onNext();
  };

  return (
    <div>
      <CheckoutChoiceGroup legend="How you would like to pay">
        <CheckoutFieldGroup>
          {PAYMENT_METHODS.map((method, index) => {
            const Mark = ROW_MARK[method.id];
            return (
              <Fragment key={method.id}>
                {index > 0 ? <CheckoutDivider /> : null}
                <div className="px-4">
                  <CheckoutChoice
                    name="payment-method"
                    value={method.id}
                    checked={draft.method === method.id}
                    disabled={!method.available}
                    onChange={(id) => onChange({ ...draft, method: id as PaymentMethodId })}
                    media={<Mark width={26} height={26} />}
                    label={method.label}
                    description={method.hint}
                  />
                </div>
              </Fragment>
            );
          })}
        </CheckoutFieldGroup>
      </CheckoutChoiceGroup>

      {/*
        Only a rail that can charge gets a form.

        A hand-built card form stood here: eleven fields including a full
        billing address, collecting a PAN and a CVV into this app's own DOM,
        for a value the wire had nowhere to carry. It could never ship as
        written — `PaymentInstrument`'s card branch takes a provider TOKEN, and
        the moment a real PAN crossed this boundary the whole web origin would
        be in PCI scope. It is deleted rather than hidden, because a hosted
        field replaces it wholesale and a dormant PAN collector in the tree is
        a liability, not a head start (ADR-047).
      */}
      <div className="mt-6">
        {draft.method === "card" ? null : (
          <PaymentMobileMoneyForm
            method={draft.method}
            phone={draft.phone}
            onChange={(phone) => onChange({ ...draft, phone })}
            showError={attempted}
          />
        )}
      </div>

      {/*
        Turning the field messages on is enough for a sighted guest, who sees
        red appear where they are looking. It is not enough for anyone else: the
        button simply did nothing and said nothing. This states the first
        problem once, in a live region, so pressing Next always produces an
        answer rather than silence.
      */}
      <p role="alert" className="mt-4 min-h-5 text-sm text-danger-text">
        {attempted && problem ? problem : ""}
      </p>

      <div className="mt-2 flex justify-end">
        <Button size="lg" onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
