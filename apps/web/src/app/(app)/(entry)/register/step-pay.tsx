"use client";

import { ArrowRight, CircleCheck, CircleAlert, FlaskConical, Landmark, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  networkForMsisdn,
  paymentRuleProblem,
  type MobileMoneyNetwork,
  type PaymentInstrument,
  type RegistrationFeeAttemptStatus,
} from "@injishi/contracts";
import { Badge, Button, Checkbox } from "@injishi/web-ui";

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
 * Step 5, Pay (ADR-075 S7, 073-gtbank-payments AC-17).
 *
 * The first press of Pay creates the registration from the answers (D-l), with
 * an \`Idempotency-Key\` minted once for that press, so a double press, a retry
 * or a second tab land on one registration (AC-14); then it pays. The press
 * needs one checkbox: the fee is not refundable.
 *
 * The fee is a mobile money Request to Pay: the registrant types the number the
 * prompt should go to, approves it on that phone, and this step waits for the
 * money to settle before the registration goes to PSF review. Only the server's
 * answer moves it on.
 *
 * - `free`: payments are off for the fee on this stack, so no number is asked
 *   for and pressing the primary action records the fee with no money moving.
 * - `test`: the mock, which every demo stack runs; the same flow, labelled as a
 *   test, so imaginary money is never mistaken for real.
 * - `live` and `unknown`: the number form. The server always decides, and
 *   ignores the number if the fee turns out to be free.
 *
 * The artboard's bank transfer is not built: GTBank collects by mobile money.
 */
export function StepPay({
  kindPhrase,
  fee,
  paid,
  paidOn,
  understood,
  onUnderstood,
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
  /** The kind mid sentence, with its article: "a coffee shop" (`kindInSentence`). */
  kindPhrase: string;
  fee: number | null;
  paid: boolean;
  /** When the fee was recorded, as a person reads it, once it is. */
  paidOn: string | null;
  /** "I understand the registration fee is not refundable." */
  understood: boolean;
  onUnderstood: (next: boolean) => void;
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
  const t = useTranslations("register.payment");
  const detected = (() => {
    const national = normaliseMsisdn(phone);
    return national ? networkForMsisdn(national) : null;
  })();
  const DetectedMark = detected ? NETWORK_MARK[detected] : Smartphone;
  const waiting = attempt?.state === "prompting" && orgId !== null;
  // The one box the press needs (ADR-075 S7), under whichever way the fee is taken here.
  const notRefundable = (
    <Checkbox
      isSelected={understood}
      onChange={(on: boolean) => onUnderstood(on)}
      className="items-start gap-3"
      controlClassName="mt-0.5"
    >
      <span className="text-sm">{t("notRefundable")}</span>
    </Checkbox>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-secondary px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{t("registrationFee", { kind: kindPhrase })}</span>
          <span className="text-2xl font-semibold tabular-nums">{fee === null ? t("notAvailable") : formatRwf(fee)}</span>
        </div>
        <div className="flex items-center gap-2">
          {feeMode === "test" && !paid ? (
            <Badge variant="warning" size="sm">
              {t("testPayment")}
            </Badge>
          ) : null}
          <Badge variant={paid ? "success" : "default"} size="sm">
            {paid ? t("paid") : waiting ? t("waiting") : t("notPaid")}
          </Badge>
        </div>
      </div>

      {paid ? (
        <>
          <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title={t("paidNext")}>
            {paidOn ? t("feeRecorded", { date: paidOn }) : ""}{t("emailDecision")}
          </Callout>
          <div>
            <Button onClick={onSeeStatus}>
              {t("seeStatus")}
              <ArrowRight size={16} aria-hidden />
            </Button>
          </div>
        </>
      ) : waiting && attempt && orgId ? (
        <PaymentPrompt
          attempt={attempt}
          poll={(token) => fetchRegistrationFeeAttempt(orgId, token)}
          landsAs={t("nextStep")}
          onSettled={onSettled}
          onEnded={onEnded}
        />
      ) : feeMode === "free" ? (
        <>
          <Callout tone="info" icon={<Landmark size={16} aria-hidden />} title={t("noPayment")}>
            {t("noPaymentInfo")}
          </Callout>
          {notRefundable}
        </>
      ) : (
        <>
          {endedReason ? (
            <Callout tone="danger" role="alert" icon={<CircleAlert size={16} aria-hidden />} title={t("failed")}>
              {endedReason} {t("tryAgain")}
            </Callout>
          ) : null}
          {feeMode === "test" ? (
            <Callout tone="warning" icon={<FlaskConical size={16} aria-hidden />} title={t("testInfoTitle")}>
              {t("testInfo")}
            </Callout>
          ) : null}
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <DetectedMark width={22} height={22} aria-hidden />
              {detected
                ? t("sendPrompt", { network: NETWORK_LABEL[detected] })
                : t("enterNumber")}
            </p>
            <CheckoutFieldGroup>
              <CheckoutField
                label={t("phone")}
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
              {t("accepted", { networks: networks.map((n) => NETWORK_LABEL[n]).join(" or ") })}
            </p>
          </div>
          {notRefundable}
        </>
      )}
    </>
  );
}
