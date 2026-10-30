"use client";

import { Fragment, useState } from "react";
import { paymentRuleProblem } from "@injishi/contracts";
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
import type { PaymentTerms } from "@/data/platform";

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
 *
 * The bank's rules come from `/platform` (073-gtbank-payments AC-23, AC-24):
 * card is not offered at all while card payments are not taken, a network the
 * bank does not prompt here is shown disabled with the sentence saying so, and
 * a total above the collection limit is said here, before pay is pressed, in
 * the words the API would refuse it with.
 */
export function StepPaymentMethod({
  draft,
  onChange,
  onNext,
  terms,
  amountRwf,
}: {
  draft: PaymentDraft;
  onChange: (draft: PaymentDraft) => void;
  onNext: () => void;
  /** The bank's rules from `/platform`, or null when it could not be read. */
  terms: PaymentTerms | null;
  /** What this checkout would collect. */
  amountRwf: number;
}) {
  const [attempted, setAttempted] = useState(false);
  const ruleFor = (id: PaymentMethodId): string | null =>
    terms
      ? paymentRuleProblem(terms, amountRwf, id === "card" ? { kind: "card" } : { kind: "mobile_money", network: id })
      : null;
  const methods = PAYMENT_METHODS.filter((m) => m.kind !== "card" || terms?.cardPayments === "live");
  const problem = ruleFor(draft.method) ?? paymentDraftProblem(draft);

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
          {methods.map((method, index) => {
            const Mark = ROW_MARK[method.id];
            const refused = ruleFor(method.id);
            return (
              <Fragment key={method.id}>
                {index > 0 ? <CheckoutDivider /> : null}
                <div className="px-4">
                  <CheckoutChoice
                    name="payment-method"
                    value={method.id}
                    checked={draft.method === method.id}
                    disabled={!method.available || refused !== null}
                    onChange={(id) => onChange({ ...draft, method: id as PaymentMethodId })}
                    media={<Mark width={26} height={26} />}
                    label={method.label}
                    description={refused ?? method.hint}
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
