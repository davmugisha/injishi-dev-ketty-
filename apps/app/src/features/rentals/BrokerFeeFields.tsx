"use client";

import { Segment } from "@heroui-pro/react";
import { type BrokerFeeKind, type BrokerFeeTerms, brokerFeeAmount, formatRwf } from "@injishi/contracts";
import { MoneyInput } from "@injishi/ui";
import { CountInput } from "./fields";

/** A fee being typed: the kind, and the number for each kind, so switching back keeps what was typed. */
export interface BrokerFeeDraft {
  kind: BrokerFeeKind;
  percent: number | null;
  amountRwf: number | null;
}

export const EMPTY_FEE: BrokerFeeDraft = { kind: "percent", percent: null, amountRwf: null };

export function feeDraftOf(terms: BrokerFeeTerms | null | undefined): BrokerFeeDraft {
  if (!terms) return EMPTY_FEE;
  return terms.kind === "percent"
    ? { kind: "percent", percent: terms.percent, amountRwf: null }
    : { kind: "fixed", percent: null, amountRwf: terms.amountRwf };
}

/** The terms the draft makes, or null while its number is empty. */
export function feeTermsOf(draft: BrokerFeeDraft): BrokerFeeTerms | null {
  if (draft.kind === "percent") return draft.percent === null ? null : { kind: "percent", percent: draft.percent };
  return draft.amountRwf === null ? null : { kind: "fixed", amountRwf: draft.amountRwf };
}

/**
 * The broker fee a landlord sets (2026-10-25): a percent of the first month's rent or fixed francs, with
 * what it comes to on the rent given. One copy for the unit form, the settings default and the lease.
 */
export function BrokerFeeFields({
  value,
  onChange,
  rentRwf,
  errorMessage,
  name = "brokerFee",
}: {
  value: BrokerFeeDraft;
  onChange: (next: BrokerFeeDraft) => void;
  /** The rent the figure is worked out on; left out, no figure. */
  rentRwf?: number | null;
  errorMessage?: string | null;
  name?: string;
}) {
  const terms = feeTermsOf(value);
  const figure = terms && rentRwf ? `${formatRwf(brokerFeeAmount(terms, rentRwf))} on this rent` : undefined;
  return (
    <div className="flex flex-col gap-3">
      <Segment
        aria-label="Broker fee"
        selectedKey={value.kind}
        onSelectionChange={(k) => onChange({ ...value, kind: String(k) as BrokerFeeKind })}
        className="w-full"
      >
        <Segment.Item id="percent">Percent of first month</Segment.Item>
        <Segment.Item id="fixed">Fixed amount</Segment.Item>
      </Segment>
      {value.kind === "percent" ? (
        <CountInput
          label="Fee"
          name={`${name}.percent`}
          value={value.percent}
          onChange={(percent) => onChange({ ...value, percent })}
          minValue={1}
          maxValue={200}
          unit="%"
          description={figure}
          errorMessage={errorMessage}
          isRequired
        />
      ) : (
        <MoneyInput
          label="Fee"
          name={`${name}.amountRwf`}
          value={value.amountRwf}
          onChange={(amountRwf) => onChange({ ...value, amountRwf })}
          minValue={1}
          errorMessage={errorMessage ?? undefined}
          isRequired
        />
      )}
    </div>
  );
}
