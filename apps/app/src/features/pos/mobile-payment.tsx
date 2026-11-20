"use client";

import { CircleCheck, CircleInfo, Clock, Smartphone } from "@gravity-ui/icons";
import { Alert, Button, Card, Input, Label, TextField, ToggleButton, toast } from "@heroui/react";
import { LinkButton } from "@injishi/ui";
import { useState, useTransition } from "react";
import {
  isMobileMethod,
  METHOD_LABEL,
  type MobileMethod,
  type PosAwaitingPayment,
  type PosAwaitingPayments,
  type PosOrder,
  type PosOutlet,
} from "@/server/pos";
import {
  confirmPaymentAction,
  emailReceiptAction,
  paymentNotReceivedAction,
  startMobilePaymentAction,
} from "./actions";
import { waitingNote, whereOf } from "./payment-flow";
import { clock, money, PosDialog, StatusChip, usePosAction, usePressKey } from "./shared";

/** The plain notice on every screen of this flow: a person checks the money, no provider is asked. */
function ManualCheckNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert status="accent" className="py-2">
      <Alert.Indicator>
        <CircleInfo />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description className="text-[12.5px]">{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

// ── The waiter's Pay ────────────────────────────────────────────────────────────────────────────────

/**
 * Pay by MTN MoMo or Airtel Money from the customer's phone. The payment is recorded PENDING and shows on the Cashier
 * Desk at once; it is never paid until the cashier sees the money arrive and confirms it.
 */
export function MobilePayDialog({
  order,
  outlet,
  onClose,
}: {
  order: PosOrder;
  outlet: PosOutlet;
  onClose: () => void;
}) {
  const { run, pending } = usePosAction();
  const methods = outlet.settings.enabledMethods.filter(isMobileMethod);
  const [method, setMethod] = useState<MobileMethod>(methods[0] ?? "mtn_momo");
  const [phone, setPhone] = useState("");
  const [key, nextKey] = usePressKey();
  const waiting = order.payments.filter((p) => p.status === "pending" || p.status === "initiated");
  const amount = order.settlement.payableRwf;
  const digits = phone.replace(/\D/g, "");
  const ok = methods.length > 0 && amount > 0 && digits.length >= 9 && digits.length <= 15;
  const send = () =>
    ok &&
    run(
      () => startMobilePaymentAction(order.id, { method, amountRwf: amount, payerPhone: phone }, key),
      "Sent to the cashier. Waiting for the money to be confirmed.",
      () => {
        nextKey();
        onClose();
      },
    );
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={amount > 0 ? `Pay ${money(amount)}` : "Payment waiting for the cashier"}
      subtitle={`${order.orderNumber} · ${whereOf(order.orderType, order.tableLabel)} · total ${money(order.totalRwf)}`}
      onEnter={send}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
          {amount > 0 ? (
            <Button size="lg" isDisabled={!ok || pending} onPress={send} data-ui="mobile-pay-send">
              <Smartphone className="size-4" />
              Pay {money(amount)} by {METHOD_LABEL[method]}
            </Button>
          ) : null}
        </>
      }
    >
      {waiting.length ? (
        <div data-ui="waiting-payments" className="flex flex-col gap-1.5 rounded-xl bg-warning-soft p-3 text-[13px]">
          <p className="font-medium text-warning-soft-foreground">
            {amount === 0
              ? "This bill is held by a payment waiting for the cashier. The cashier confirms it once the money has arrived."
              : "Part of this bill is held by a payment waiting for the cashier."}
          </p>
          {waiting.map((p) => (
            <p key={p.id} className="flex flex-wrap gap-2 tabular">
              <span className="font-medium">{METHOD_LABEL[p.method]}</span>
              <span>{money(p.amountRwf)}</span>
              <span className="text-muted">{p.demoReference}</span>
              <span className="text-muted">· started {clock(p.createdAt)}</span>
            </p>
          ))}
        </div>
      ) : null}
      {amount > 0 ? (
        methods.length === 0 ? (
          <p className="text-[13px] text-danger">
            Neither MTN MoMo nor Airtel Money is enabled at this outlet. A manager turns them on in Setup.
          </p>
        ) : (
          <>
            <ManualCheckNotice>
              The customer pays {money(amount)} to the venue's {METHOD_LABEL[method]} account from their own phone. The
              bill stays unpaid until the cashier sees the money arrive and confirms it. You are told here when they do.
            </ManualCheckNotice>
            <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0" aria-label="Payment method">
              {methods.map((m) => (
                <ToggleButton key={m} isSelected={method === m} onChange={() => setMethod(m)}>
                  {METHOD_LABEL[m]}
                </ToggleButton>
              ))}
            </fieldset>
            <TextField value={phone} onChange={setPhone} fullWidth isRequired autoFocus>
              <Label>Customer's phone number (the one they pay from)</Label>
              <Input inputMode="tel" placeholder="078 812 3456" />
            </TextField>
          </>
        )
      ) : null}
    </PosDialog>
  );
}

// ── The Cashier Desk ────────────────────────────────────────────────────────────────────────────────

/** The two mobile money brands, so a cashier finds the right account at a glance. */
export function MethodBadge({ method }: { method: string }) {
  const style =
    method === "mtn_momo"
      ? "bg-[#ffcb05] text-[#1a1a1a]"
      : method === "airtel_money"
        ? "bg-[#e4002b] text-white"
        : "bg-default text-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${style}`}
    >
      {METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? method}
    </span>
  );
}

/**
 * Step 1 of the desk: MTN MoMo and Airtel Money payments the customer started, waiting for the cashier to see the
 * money arrive, oldest first. Display only: Confirm and Not received open the same dialogs as before.
 */
export function PaymentsAwaiting({ data, now }: { data: PosAwaitingPayments; now: number }) {
  const [confirming, setConfirming] = useState<PosAwaitingPayment | null>(null);
  const [refusing, setRefusing] = useState<PosAwaitingPayment | null>(null);
  const { awaiting, recent } = data;
  const total = awaiting.reduce((a, p) => a + p.amountRwf, 0);
  return (
    <Card
      id="desk-confirm"
      className={`scroll-mt-4 gap-3 rounded-[20px] p-4 shadow-none sm:p-5 ${awaiting.length ? "ring-2 ring-warning/50" : ""}`}
      aria-label="Payments awaiting confirmation"
      data-ui="payments-awaiting"
    >
      <SectionHead
        step={1}
        title="Payments awaiting confirmation"
        hint={
          awaiting.length === 0
            ? "MTN MoMo and Airtel Money payments appear here by themselves when a waiter presses Pay."
            : "Confirm each one only after the money shows on the venue's MTN MoMo or Airtel Money account."
        }
        right={
          awaiting.length ? (
            <StatusChip color="warning">
              {awaiting.length} to check · {money(total)}
            </StatusChip>
          ) : (
            <StatusChip color="success">Nothing to confirm</StatusChip>
          )
        }
      />
      {awaiting.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {awaiting.map((p) => {
            const wait = waitingNote(p.startedAt, now);
            return (
              <li
                key={p.paymentId}
                data-payment={p.reference}
                className={`grid gap-x-4 gap-y-2 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${wait.tone === "old" ? "border-separator bg-default/40" : "border-warning/50 bg-warning-soft/40"}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[20px] leading-6 font-bold tabular">{money(p.amountRwf)}</span>
                    <MethodBadge method={p.method} />
                    <StatusChip
                      color={wait.tone === "new" ? "accent" : wait.tone === "waiting" ? "warning" : "default"}
                    >
                      {wait.text}
                    </StatusChip>
                  </div>
                  <p className="text-[14px] font-semibold">
                    <span className="whitespace-nowrap">{whereOf(p.orderType, p.tableLabel)}</span>
                    <span className="ml-2 text-[12.5px] font-normal whitespace-nowrap text-muted tabular">
                      {p.orderNumber}
                    </span>
                    {p.customerName ? <span className="ml-2 text-[13px] font-normal">· {p.customerName}</span> : null}
                  </p>
                  {/* Each fact stays whole; the line breaks between them, so a phone never cuts one off. */}
                  <p className="flex min-w-0 flex-wrap gap-x-1.5 text-[12px] text-muted tabular">
                    {p.payerPhoneMasked ? <span className="whitespace-nowrap">From {p.payerPhoneMasked} ·</span> : null}
                    <span className="break-all">Ref {p.reference} ·</span>
                    <span>
                      started {clock(p.startedAt)}
                      {p.startedByName ? ` by ${p.startedByName}` : ""}
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {p.confirmable ? (
                    <>
                      <Button onPress={() => setConfirming(p)} data-ui="confirm-payment">
                        <CircleCheck className="size-4" />
                        Confirm
                      </Button>
                      <Button variant="secondary" onPress={() => setRefusing(p)}>
                        Not received
                      </Button>
                    </>
                  ) : (
                    <LinkButton href={`/pos/till?order=${p.orderId}&pay=1`} variant="secondary" className="col-span-2">
                      View bill
                    </LinkButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {recent.length > 0 ? (
        <details className="rounded-xl bg-default/40 px-3 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-medium text-muted">
            Answered in the last 12 hours ({recent.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {recent.map((d) => (
              <li key={`${d.paymentId}-${d.at}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular">
                <StatusChip color={d.outcome === "confirmed" ? "success" : "danger"}>
                  {d.outcome === "confirmed" ? "Confirmed" : "Not received"}
                </StatusChip>
                <MethodBadge method={d.method} />
                <span className="font-medium">{money(d.amountRwf)}</span>
                <span>
                  {whereOf("", d.tableLabel)} · {d.orderNumber}
                </span>
                <span className="text-muted">
                  {d.byName ? `by ${d.byName} ` : ""}at {clock(d.at)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {confirming ? <ConfirmDialog payment={confirming} onClose={() => setConfirming(null)} /> : null}
      {refusing ? <NotReceivedDialog payment={refusing} onClose={() => setRefusing(null)} /> : null}
    </Card>
  );
}

/** A desk section's heading: its step number, title, one line of help, and a status on the right. */
export function SectionHead({
  step,
  title,
  hint,
  right,
}: {
  step?: number;
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-start gap-2.5">
        {step ? (
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-background"
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[16px] leading-6 font-semibold">{title}</h2>
          {hint ? <p className="text-[12.5px] text-muted">{hint}</p> : null}
        </div>
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

function ConfirmDialog({ payment: p, onClose }: { payment: PosAwaitingPayment; onClose: () => void }) {
  const { run, pending } = usePosAction();
  const [seen, setSeen] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const idOk = /^[A-Za-z0-9._-]*$/.test(transactionId.trim());
  const confirm = () =>
    seen &&
    idOk &&
    run(
      () => confirmPaymentAction(p.paymentId, transactionId),
      (o) =>
        o.settlement.settled
          ? `${o.orderNumber} is paid. The waiter has been told.`
          : `Payment confirmed. ${money(o.settlement.outstandingRwf)} still to pay on ${o.orderNumber}.`,
      onClose,
    );
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Confirm ${money(p.amountRwf)} by ${METHOD_LABEL[p.method]}`}
      subtitle={`${p.orderNumber} · ${whereOf(p.orderType, p.tableLabel)} · ref ${p.reference}`}
      onEnter={confirm}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Not yet
          </Button>
          <Button size="lg" isDisabled={!seen || !idOk || pending} onPress={confirm} data-ui="confirm-payment-final">
            <CircleCheck className="size-4" />
            Money received · confirm
          </Button>
        </>
      }
    >
      <ManualCheckNotice>
        Look at the venue's {METHOD_LABEL[p.method]} account or its message: {money(p.amountRwf)} must have arrived
        {p.payerPhoneMasked ? ` from ${p.payerPhoneMasked}` : ""}. The system does not check with the provider: your
        confirmation is what marks the bill paid, and it is recorded under your name.
      </ManualCheckNotice>
      <label className="flex items-start gap-2 text-[14px]">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={seen}
          onChange={(e) => setSeen(e.target.checked)}
          data-ui="money-seen"
        />
        <span>I have seen {money(p.amountRwf)} arrive on the account.</span>
      </label>
      <TextField value={transactionId} onChange={setTransactionId} fullWidth isInvalid={!idOk}>
        <Label>Transaction ID from the message (optional)</Label>
        <Input placeholder="e.g. 18234567890" />
      </TextField>
    </PosDialog>
  );
}

function NotReceivedDialog({ payment: p, onClose }: { payment: PosAwaitingPayment; onClose: () => void }) {
  const { run, pending } = usePosAction();
  const [reason, setReason] = useState("The money did not arrive.");
  const ok = reason.trim().length >= 3;
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Not received: ${money(p.amountRwf)}`}
      subtitle={`${p.orderNumber} · ${whereOf(p.orderType, p.tableLabel)} · ref ${p.reference}`}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Keep waiting
          </Button>
          <Button
            variant="danger"
            isDisabled={!ok || pending}
            onPress={() =>
              run(
                () => paymentNotReceivedAction(p.paymentId, reason.trim()),
                "Marked not received. The bill is open again.",
                onClose,
              )
            }
          >
            Mark not received
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">
        The payment is recorded as failed with your reason, the bill is owed again, and the waiter is told.
      </p>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason</Label>
        <Input />
      </TextField>
    </PosDialog>
  );
}

// ── Receipts ────────────────────────────────────────────────────────────────────────────────────────

/** Email the receipt of a paid bill, only to an address the customer gives, only when they ask. Nothing is stored. */
export function EmailReceiptDialog({
  orderId,
  orderNumber,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, start] = useTransition();
  const ok = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]+$/.test(email.trim());
  const send = () =>
    ok &&
    start(async () => {
      const r = await emailReceiptAction(orderId, email);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`Receipt ${orderNumber} sent to ${r.value.to}`);
      onClose();
    });
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Email receipt ${orderNumber}`}
      subtitle="Only if the customer asks for it."
      onEnter={send}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isDisabled={!ok || busy} onPress={send} data-ui="email-receipt-send">
            {busy ? <Clock className="size-4" /> : null}
            Send receipt
          </Button>
        </>
      }
    >
      <TextField value={email} onChange={setEmail} fullWidth isRequired autoFocus type="email">
        <Label>Customer's email</Label>
        <Input placeholder="name@example.com" />
      </TextField>
      <p className="text-[12px] text-muted">The address is used for this email only and is not saved with the bill.</p>
    </PosDialog>
  );
}
