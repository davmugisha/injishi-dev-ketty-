"use client";

import { ArrowRight, CircleCheck, CircleAlert, FlaskConical, Landmark, Smartphone } from "lucide-react";
import {
  networkForMsisdn,
  paymentRuleProblem,
  type MobileMoneyNetwork,
  type PaymentInstrument,
  type RegistrationFeeAttemptStatus,
} from "@injishi/contracts";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { PaymentPrompt } from "@/components/book/payment-prompt";
import { CheckoutField, CheckoutFieldGroup } from "@/components/book/checkout-field";
import { AirtelMark, MtnMark } from "@/components/icons/marks";
import type { RegistrationFeeMode } from "@/data/platform";
import { fetchRegistrationFeeAttempt } from "@/data/registration";
import { groupHandset, normaliseMsisdn } from "@/lib/payment-methods";

import { Callout } from "./register-shell";
import { formatRwf } from "./wizard-ui";

const NETWORK_LABEL: Record<MobileMoneyNetwork, string> = {
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
};
const NETWORK_MARK: Record<MobileMoneyNetwork, typeof MtnMark> = {
  mtn_momo: MtnMark,
  airtel_money: AirtelMark,
};

/**
 * The mobile money instrument a typed number stands for, or the sentence that
 * says why it cannot be charged yet. The network is read from the number's
 * prefix (one rule, shared with the server), so the registrant types a number
 * and nothing else, and a number on a network this stack does not prompt, or
 * a fee above the bank's collection limit, is refused here, before the press,
 * in the words the API would refuse it with (073-gtbank-payments AC-23).
 */
export function feeInstrument(
  phone: string,
  networks: readonly MobileMoneyNetwork[],
  maxCollectionRwf: number | null = null,
  amountRwf: number | null = null,
): { instrument: PaymentInstrument; problem: null } | { instrument: null; problem: string } {
  const national = normaliseMsisdn(phone);
  if (!national) return { instrument: null, problem: "Enter a Rwandan mobile number, like 078 812 3456." };
  const network = networkForMsisdn(national);
  if (!network) return { instrument: null, problem: "That number is not on MTN MoMo or Airtel Money." };
  const rule = paymentRuleProblem(
    { rules: { networks: [...networks], maxCollectionRwf, livePurposes: [] }, cardPayments: "off" },
    amountRwf ?? 0,
    { kind: "mobile_money", network },
  );
  if (rule) return { instrument: null, problem: rule };
  return { instrument: { kind: "mobile_money", network, msisdn: national }, problem: null };
}

/**
 * A fee above the bank's collection limit, said before anything is typed
 * (073-gtbank-payments AC-23), or null.
 */
export function feeLimitProblem(
  fee: number | null,
  networks: readonly MobileMoneyNetwork[],
  maxCollectionRwf: number | null,
): string | null {
  const network = networks[0];
  if (fee === null || maxCollectionRwf === null || !network) return null;
  return paymentRuleProblem(
    { rules: { networks: [...networks], maxCollectionRwf, livePurposes: [] }, cardPayments: "off" },
    fee,
    { kind: "mobile_money", network },
  );
}

/**
 * Step 6, Pay (073-gtbank-payments AC-17).
 *
 * The fee is a mobile money Request to Pay: the registrant types the number the
 * prompt should go to, approves it on that phone, and this step waits for the
 * money to settle before the registration goes for review. Only the server's
 * answer moves it on.
 *
 * - `free`: payments are off for the fee on this stack, so no number is asked
 *   for and pressing the primary action records the fee with no money moving.
 * - `test`: the mock; the same flow, labelled as a test, so imaginary money is
 *   never mistaken for real.
 * - `live` and `unknown`: the number form. The server always decides, and
 *   ignores the number if the fee turns out to be free.
 *
 * The artboard's bank transfer is not built: GTBank collects by mobile money.
 */
export function StepPay({
  kindLabel,
  fee,
  paid,
  paidOn,
  onSeeStatus,
  feeMode,
  phone,
  onPhone,
  phoneProblem,
  networks,
  orgId,
  attempt,
  endedReason,
  onSettled,
  onEnded,
}: {
  kindLabel: string;
  fee: number | null;
  paid: boolean;
  /** When the fee was recorded, as a person reads it, once it is. */
  paidOn: string | null;
  onSeeStatus: () => void;
  feeMode: RegistrationFeeMode;
  /** The number as typed. */
  phone: string;
  onPhone: (phone: string) => void;
  /** Shown once the registrant has pressed pay with a number that cannot be charged. */
  phoneProblem: string | null;
  networks: readonly MobileMoneyNetwork[];
  orgId: string | null;
  /** The press waiting on the registrant's phone, if one is. */
  attempt: RegistrationFeeAttemptStatus | null;
  /** Why the last press ended without paying (declined, timed out), as the server said it. */
  endedReason: string | null;
  onSettled: (settled: RegistrationFeeAttemptStatus) => void;
  onEnded: (ended: RegistrationFeeAttemptStatus) => void;
}) {
  const detected = (() => {
    const national = normaliseMsisdn(phone);
    return national ? networkForMsisdn(national) : null;
  })();
  const DetectedMark = detected ? NETWORK_MARK[detected] : Smartphone;
  const waiting = attempt?.state === "prompting" && orgId !== null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-secondary px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">Registration fee for a {kindLabel}</span>
          <span className="text-2xl font-semibold tabular-nums">{fee === null ? "Not available yet" : formatRwf(fee)}</span>
        </div>
        <div className="flex items-center gap-2">
          {feeMode === "test" && !paid ? (
            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">Test payment</span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              paid ? "bg-success/15 text-success" : "bg-card text-muted-foreground",
            )}
          >
            {paid ? "Paid" : waiting ? "Waiting for your approval" : "Not paid yet"}
          </span>
        </div>
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
      ) : waiting && attempt && orgId ? (
        <PaymentPrompt
          attempt={attempt}
          poll={(token) => fetchRegistrationFeeAttempt(orgId, token)}
          landsAs="your registration's next step"
          onSettled={onSettled}
          onEnded={onEnded}
        />
      ) : feeMode === "free" ? (
        <Callout tone="info" icon={<Landmark size={16} aria-hidden />} title="No payment is taken yet">
          Payments are not switched on for registrations yet, so no money moves. Pressing Submit records the fee against
          this registration and sends it to Injishi for review.
        </Callout>
      ) : (
        <>
          {endedReason ? (
            <Callout tone="danger" role="alert" icon={<CircleAlert size={16} aria-hidden />} title="That payment did not go through">
              {endedReason} You can try again.
            </Callout>
          ) : null}
          {feeMode === "test" ? (
            <Callout tone="warning" icon={<FlaskConical size={16} aria-hidden />} title="This is a test payment">
              This stack takes no real money. The prompt is simulated, and a number ending 0000 is declined so you can see
              that path too.
            </Callout>
          ) : null}
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <DetectedMark width={22} height={22} aria-hidden />
              {detected
                ? `We will send a ${NETWORK_LABEL[detected]} prompt to this number. Approve it on that phone.`
                : "Enter the mobile money number to pay from. We send a prompt to that phone to approve."}
            </p>
            <CheckoutFieldGroup>
              <CheckoutField
                label="Mobile money number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="078 812 3456"
                reformats
                value={groupHandset(phone)}
                onChange={onPhone}
                error={phoneProblem}
              />
            </CheckoutFieldGroup>
            <p className="text-xs text-muted-foreground">
              Accepted: {networks.map((n) => NETWORK_LABEL[n]).join(" or ")}. Nothing is taken until you approve the prompt.
            </p>
          </div>
        </>
      )}
    </>
  );
}
