"use client";

import { Description, Label, Spinner } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  type LeaseChargeView,
  type MomoNetwork,
  momoNetworkOf,
  type TenantChargeList,
  type TenantPaymentMethod,
  type TenantPaymentView,
} from "@injishi/contracts";
import { ActionButton, ActionLink, formatDay, formatMoney, Icon, MoneyInput, PhoneInput, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { receiptHref } from "../leases/shared";
import { fieldErrorsOnly } from "../rentals/fields";
import { payRent, pollPayment } from "./actions";

const METHODS: { id: TenantPaymentMethod; title: string; hint: string; network: MomoNetwork }[] = [
  { id: "mtn_momo", title: "MTN MoMo", hint: "078 or 079", network: "mtn" },
  { id: "airtel_money", title: "Airtel Money", hint: "072 or 073", network: "airtel" },
];

/**
 * Pay rent by mobile money (P3.3): MTN or Airtel, the number the prompt goes to, everything owed or
 * another amount up to what may be paid now. Then it waits for the phone, asking the API every couple
 * of seconds, and ends on the receipt or on what went wrong. A payment already waiting opens on its wait.
 */
export function PayPanel({
  leaseId,
  charges,
  phone,
  waitingId,
  only = null,
  onClose,
}: {
  leaseId: string;
  charges: TenantChargeList;
  /** The tenant's own number, offered first. */
  phone: string | null;
  /** A payment already waiting on the phone. */
  waitingId: string | null;
  /** Pay this one charge (the deposit, one month), all of what it still owes. */
  only?: LeaseChargeView | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const owed = charges.outstandingRwf;
  const [method, setMethod] = useState<TenantPaymentMethod | null>(() => {
    const net = phone ? momoNetworkOf(phone) : null;
    return net === "airtel" ? "airtel_money" : net === "mtn" ? "mtn_momo" : null;
  });
  const [msisdn, setMsisdn] = useState<string | null>(phone);
  const [msisdnText, setMsisdnText] = useState(phone ?? "");
  const [how, setHow] = useState<"all" | "other">("all");
  const [amount, setAmount] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<TenantPaymentView | null>(null);
  const [watching, setWatching] = useState<string | null>(waitingId);
  const picked = useRef(method !== null);

  // Wait for the phone: ask where the payment stands until it is no longer waiting.
  useEffect(() => {
    if (!watching) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await pollPayment(leaseId, watching);
      if (!live) return;
      if (r.ok) {
        setPayment(r.value);
        if (r.value.status !== "pending") {
          setWatching(null);
          router.refresh();
          return;
        }
      }
      timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [watching, leaseId, router]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!method) next.method = "Pick MTN MoMo or Airtel Money.";
    if (!msisdn) next.msisdn = "Enter the number the prompt goes to.";
    if (!only && how === "other" && (!amount || amount <= 0)) next.amountRwf = "Enter the amount to pay.";
    if (!only && how === "other" && amount && amount > charges.maxPaymentRwf)
      next.amountRwf = `Pay at most ${formatMoney(charges.maxPaymentRwf)} now.`;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    setSending(true);
    const r = await payRent(leaseId, {
      method,
      msisdn: msisdn ?? msisdnText,
      ...(only
        ? { amountRwf: only.outstandingRwf, chargeIds: [only.id] }
        : how === "other" && amount
          ? { amountRwf: amount }
          : {}),
    });
    setSending(false);
    if (!r.ok) {
      setErrors(fieldErrorsOnly(r.fieldErrors));
      setFormError(r.fieldErrors && Object.keys(fieldErrorsOnly(r.fieldErrors)).length > 0 ? null : r.error);
      return;
    }
    setPayment(r.value);
    if (r.value.status === "pending") setWatching(r.value.id);
    else router.refresh();
  };

  const waiting = watching !== null || payment?.status === "pending";
  const status = payment?.status ?? (waiting ? "pending" : null);

  if (status !== null) {
    return (
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={status === "succeeded" ? "Paid" : status === "pending" ? "Approve on your phone" : "Not paid"}
        description={
          payment
            ? `${formatMoney(payment.amountRwf)}${payment.payerMasked ? ` from ${payment.payerMasked}` : ""}`
            : undefined
        }
        footer={
          status === "pending" ? (
            <ActionButton onPress={onClose}>Close, keep waiting</ActionButton>
          ) : status === "succeeded" ? (
            <ActionButton intent="primary" onPress={onClose}>
              Done
            </ActionButton>
          ) : (
            <>
              <ActionButton onPress={onClose}>Close</ActionButton>
              <ActionButton
                intent="primary"
                icon="ArrowRotateRight"
                onPress={() => {
                  setPayment(null);
                  setWatching(null);
                }}
              >
                Try again
              </ActionButton>
            </>
          )
        }
      >
        <div className="flex flex-col items-start gap-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <span
              className={
                status === "succeeded"
                  ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                  : status === "pending"
                    ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                    : "flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
              }
            >
              {status === "pending" ? (
                <Spinner size="sm" color="current" />
              ) : (
                <Icon name={status === "succeeded" ? "CircleCheck" : "CircleXmark"} className="size-5" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">
                {status === "succeeded"
                  ? `${formatMoney(payment?.amountRwf ?? 0)} received`
                  : status === "pending"
                    ? "A prompt is on its way to your phone"
                    : "The payment did not go through"}
              </span>
              <span className="text-sm text-pretty text-muted">
                {payment?.statusWords ?? "Waiting for you to approve the prompt on your phone."}
              </span>
            </div>
          </div>
          {status === "pending" ? (
            <p className="text-xs text-muted">Enter your PIN on the phone. This page updates by itself.</p>
          ) : null}
          {status === "succeeded" && payment ? (
            <div className="flex flex-col gap-2">
              {payment.allocations.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {payment.allocations.map((a) => (
                    <li key={a.chargeId} className="flex justify-between gap-6">
                      <span>{a.label}</span>
                      <span className="tabular">{formatMoney(a.amountRwf)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {payment.creditRwf > 0 ? (
                <p className="text-xs text-muted">{formatMoney(payment.creditRwf)} kept as credit for the next rent.</p>
              ) : null}
              {payment.receiptReady ? (
                <ActionLink
                  href={receiptHref(leaseId, payment.id)}
                  target="_blank"
                  rel="noopener"
                  icon="FileArrowDown"
                  className="self-start"
                >
                  Receipt {payment.receiptNumber ?? ""}
                </ActionLink>
              ) : (
                <p className="text-xs text-muted">The receipt is being made. It shows under Rent.</p>
              )}
            </div>
          ) : null}
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={only ? `Pay: ${only.label}` : "Pay rent"}
      description={
        only
          ? `${formatMoney(only.outstandingRwf)}, due ${formatDay(only.dueOn, "long")}`
          : owed > 0
            ? `${formatMoney(owed)} owed now`
            : "Nothing is owed now"
      }
      submitLabel={
        only
          ? `Pay ${formatMoney(only.outstandingRwf)}`
          : how === "all"
            ? `Pay ${formatMoney(owed)}`
            : amount
              ? `Pay ${formatMoney(amount)}`
              : "Pay"
      }
      submitIcon="Wallet"
      isPending={sending}
      isSubmitDisabled={only ? only.outstandingRwf <= 0 : charges.maxPaymentRwf <= 0}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pay with</span>
        <RadioButtonGroup
          aria-label="Pay with"
          layout="grid"
          value={method ?? ""}
          onChange={(v) => {
            picked.current = true;
            setMethod(v as TenantPaymentMethod);
            setErrors((e) => ({ ...e, method: "" }));
          }}
          className="grid-cols-2 gap-2.5"
        >
          {METHODS.map((m) => (
            <RadioButtonGroup.Item key={m.id} value={m.id} className="gap-1 px-3.5 py-3">
              <RadioButtonGroup.Indicator>
                <Icon name="CircleCheckFill" />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemContent>
                <Label className="font-semibold">{m.title}</Label>
                <Description className="text-xs">{m.hint}</Description>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        {errors.method ? <p className="text-xs text-danger">{errors.method}</p> : null}
      </div>
      <PhoneInput
        label="Number the prompt goes to"
        name="msisdn"
        value={msisdn}
        onChange={(e164, text) => {
          setMsisdn(e164);
          setMsisdnText(text);
          setErrors((e) => ({ ...e, msisdn: "" }));
          // The network follows the number until the person picks one.
          const net = e164 ? momoNetworkOf(e164) : null;
          if (net && !picked.current) setMethod(net === "airtel" ? "airtel_money" : "mtn_momo");
        }}
        errorMessage={errors.msisdn || null}
        isRequired
      />
      <div className={only ? "hidden" : "flex flex-col gap-2"}>
        <span className="text-sm font-medium">How much</span>
        <Segment
          aria-label="How much"
          selectedKey={how}
          onSelectionChange={(k) => setHow(k === "other" ? "other" : "all")}
          className="w-fit"
        >
          <Segment.Item id="all">Everything owed</Segment.Item>
          <Segment.Item id="other">Another amount</Segment.Item>
        </Segment>
        {how === "other" ? (
          <MoneyInput
            label="Amount"
            name="amountRwf"
            value={amount}
            onChange={setAmount}
            minValue={1}
            maxValue={charges.maxPaymentRwf}
            description={`Up to ${formatMoney(charges.maxPaymentRwf)}. Less pays the oldest charges first; more is kept as credit.`}
            errorMessage={errors.amountRwf || null}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted">Injishi takes no fee. Your landlord receives the money on their account.</p>
    </SidePanel>
  );
}
