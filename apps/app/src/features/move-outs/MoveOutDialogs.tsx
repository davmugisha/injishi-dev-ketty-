"use client";

import { Description, Label, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import {
  type DepositView,
  keptOf,
  MOVE_OUT_REASON_LABEL,
  MoveOutReasonCode,
  NOTICE_CHANNEL_LABEL,
  type RecordedNoticeChannel,
  settlementProblem,
} from "@injishi/contracts";
import {
  ActionButton,
  BoundedDatePicker,
  ConfirmDialog,
  FormDialog,
  formatDay,
  formatMoney,
  Icon,
  IconAction,
  KeyValueList,
  Money,
  MoneyInput,
  PhoneInput,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { TextInput } from "../rentals/fields";
import { acknowledgeNotice, loadDeposit, recordMoveOut, recordNotice, settleDeposit } from "./actions";

/** Acknowledge a notice: the lease is ending and the tenant is emailed. */
export function AcknowledgeDialog({
  leaseId,
  tenantName,
  moveOutOn,
  onClose,
}: {
  leaseId: string;
  tenantName: string;
  moveOutOn: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Acknowledge the notice?"
      confirmLabel="Acknowledge"
      confirmIcon="CircleCheck"
      isPending={pending}
      onConfirm={() =>
        start(async () => {
          const r = await acknowledgeNotice(leaseId);
          if (!r.ok) {
            toast.danger(r.error);
            return;
          }
          toast.success("Notice acknowledged");
          onClose();
          router.refresh();
        })
      }
    >
      {tenantName} moves out on {formatDay(moveOutOn, "long")}. They get an email.
    </ConfirmDialog>
  );
}

/** The day the tenant moved out: today or earlier, never before the start. */
export function RecordMoveOutDialog({
  leaseId,
  tenantName,
  startDate,
  today,
  suggested,
  onClose,
}: {
  leaseId: string;
  tenantName: string;
  startDate: string;
  today: string;
  suggested: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [day, setDay] = useState<string | null>(
    suggested && suggested <= today && suggested >= startDate ? suggested : today,
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Record the move out"
      size="sm"
      submitLabel="Record move out"
      isPending={pending}
      footerHint="Rent for after that day is cancelled."
      onSubmit={(e) => {
        e.preventDefault();
        if (!day) {
          setErrors({ movedOutOn: "Pick a date." });
          return;
        }
        start(async () => {
          const r = await recordMoveOut(leaseId, { movedOutOn: day, note: note || undefined });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            if (!r.fieldErrors) toast.danger(r.error);
            return;
          }
          toast.success(`${tenantName} moved out`);
          onClose();
          router.refresh();
        });
      }}
    >
      <BoundedDatePicker
        label="Moved out on"
        name="movedOutOn"
        value={day}
        onChange={(d) => {
          setDay(d);
          setErrors({});
        }}
        minValue={startDate}
        maxValue={today}
        errorMessage={errors.movedOutOn}
        isRequired
      />
      <TextInput label="Note" name="note" value={note} onChange={setNote} multiline errorMessage={errors.note} />
    </FormDialog>
  );
}

const CHANNELS: RecordedNoticeChannel[] = ["letter", "email", "in_person"];

/** A notice that reached the landlord outside Injishi, or one the landlord gives. */
export function RecordNoticeDialog({
  leaseId,
  startDate,
  endDate,
  today,
  onClose,
}: {
  leaseId: string;
  startDate: string;
  endDate: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [givenBy, setGivenBy] = useState<"tenant" | "landlord">("tenant");
  const [channel, setChannel] = useState<RecordedNoticeChannel>("letter");
  const [filedOn, setFiledOn] = useState<string | null>(today);
  const [moveOutOn, setMoveOutOn] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Record a notice"
      submitLabel="Record notice"
      isPending={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const missing: Record<string, string> = {};
        if (!filedOn) missing.filedOn = "Pick a date.";
        if (!moveOutOn) missing.moveOutOn = "Pick a date.";
        if (!reason) missing.reasonCode = "Pick a reason.";
        if (Object.keys(missing).length > 0) {
          setErrors(missing);
          return;
        }
        start(async () => {
          const r = await recordNotice(leaseId, {
            givenBy,
            channel,
            filedOn,
            moveOutOn,
            reasonCode: reason,
            message: message || undefined,
          });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            if (!r.fieldErrors) toast.danger(r.error);
            return;
          }
          toast.success("Notice recorded");
          onClose();
          router.refresh();
        });
      }}
    >
      <RadioButtonGroup
        aria-label="Who gave notice"
        layout="grid"
        value={givenBy}
        onChange={(v) => setGivenBy(v as "tenant" | "landlord")}
        className="grid-cols-2 gap-2.5"
      >
        {(["tenant", "landlord"] as const).map((g) => (
          <RadioButtonGroup.Item key={g} value={g} className="px-3.5 py-3">
            <RadioButtonGroup.Indicator>
              <Icon name="CircleCheckFill" />
            </RadioButtonGroup.Indicator>
            <RadioButtonGroup.ItemContent>
              <Label className="font-semibold">{g === "tenant" ? "From the tenant" : "From you"}</Label>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        ))}
      </RadioButtonGroup>
      <SelectField
        label="How it came"
        options={CHANNELS.map((c) => ({ id: c, label: NOTICE_CHANNEL_LABEL[c] }))}
        value={channel}
        onChange={(v) => setChannel(v as RecordedNoticeChannel)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <BoundedDatePicker
          label="Given on"
          value={filedOn}
          onChange={(d) => {
            setFiledOn(d);
            setErrors((x) => ({ ...x, filedOn: "" }));
          }}
          minValue={startDate}
          maxValue={today}
          errorMessage={errors.filedOn || null}
          isRequired
        />
        <BoundedDatePicker
          label="Moving out on"
          value={moveOutOn}
          onChange={(d) => {
            setMoveOutOn(d);
            setErrors((x) => ({ ...x, moveOutOn: "" }));
          }}
          minValue={filedOn ?? startDate}
          maxValue={endDate}
          errorMessage={errors.moveOutOn || null}
          isRequired
        />
      </div>
      <SelectField
        label="Reason"
        options={MoveOutReasonCode.options.map((c) => ({ id: c, label: MOVE_OUT_REASON_LABEL[c] }))}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setErrors((x) => ({ ...x, reasonCode: "" }));
        }}
        errorMessage={errors.reasonCode || null}
        isRequired
      />
      <TextInput label="Note" name="message" value={message} onChange={setMessage} multiline />
    </FormDialog>
  );
}

type RefundMethod = "gateway" | "recorded" | "none";

const METHOD_WORDS: Record<RefundMethod, { title: string; hint: string }> = {
  gateway: { title: "MoMo on Injishi", hint: "From your phone" },
  recorded: { title: "Paid outside", hint: "Cash or transfer" },
  none: { title: "No refund", hint: "You keep it all" },
};

interface DeductionDraft {
  key: number;
  label: string;
  amountRwf: number | null;
}

/**
 * Settle the deposit: the deductions kept, item by item, the refund that must balance with what the
 * tenant paid, and how it goes back. A MoMo refund waits on the landlord's phone; the panel looks again
 * every few seconds until it is approved or refused.
 */
export function SettleDepositPanel({
  deposit: initial,
  tenantName,
  tenantPhone,
  endedOn,
  today,
  onClose,
}: {
  deposit: DepositView;
  tenantName: string;
  tenantPhone: string | null;
  endedOn: string | null;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [deposit, setDeposit] = useState(initial);
  const [rows, setRows] = useState<DeductionDraft[]>(() =>
    initial.deductions.length > 0 && initial.refundStatus === "failed"
      ? initial.deductions.map((d, i) => ({ key: i, label: d.label, amountRwf: d.amountRwf }))
      : [],
  );
  const next = useRef(rows.length + 1);
  const [method, setMethod] = useState<RefundMethod>(initial.paidRwf > 0 ? "gateway" : "none");
  const [tenantMomo, setTenantMomo] = useState<string | null>(tenantPhone);
  const [payer, setPayer] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState<string | null>(today);
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();

  const deductions = rows
    .filter((r) => r.label.trim() || r.amountRwf)
    .map((r) => ({ label: r.label.trim(), amountRwf: r.amountRwf ?? 0 }));
  const kept = keptOf(deductions);
  const refunded = Math.max(0, deposit.paidRwf - kept);
  const effective: RefundMethod = refunded === 0 ? "none" : method === "none" ? "recorded" : method;
  const balance = settlementProblem({ paidRwf: deposit.paidRwf, deductions, refundedRwf: refunded, method: effective });
  const waiting = deposit.refundStatus === "waiting";
  const settled = deposit.status === "settled";

  // A refund on the landlord's phone: look again until it is approved or refused.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const r = await loadDeposit(deposit.id);
      if (!r.ok) return;
      setDeposit(r.value);
      if (r.value.refundStatus !== "waiting") {
        if (r.value.status === "settled") toast.success("Refund sent. The deposit is settled.");
        else if (r.value.refundStatus === "failed") {
          setKey(crypto.randomUUID());
          setFormError(r.value.refundFailureReason ?? "The refund did not go through.");
        }
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, deposit.id, router]);

  const submit = () => {
    const missing: Record<string, string> = {};
    rows.forEach((r, i) => {
      if (!r.label.trim() && !r.amountRwf) return;
      if (r.label.trim().length < 2) missing[`deductions.${i}.label`] = "Say what it is for.";
      if (!r.amountRwf || r.amountRwf <= 0) missing[`deductions.${i}.amountRwf`] = "Enter an amount above 0.";
    });
    if (effective === "gateway") {
      if (!tenantMomo) missing["refund.tenantPhone"] = "Enter the tenant's MoMo number.";
      if (!payer) missing["refund.payerPhone"] = "Enter your MTN or Airtel number.";
    }
    if (effective === "recorded" && !paidOn) missing["refund.paidOn"] = "Pick a date.";
    setErrors(missing);
    if (Object.keys(missing).length > 0 || balance) return;
    setFormError(null);
    const refund =
      effective === "gateway"
        ? { method: "gateway" as const, tenantPhone: tenantMomo, payerPhone: payer }
        : effective === "recorded"
          ? { method: "recorded" as const, paidOn, reference: reference || undefined }
          : { method: "none" as const };
    start(async () => {
      const r = await settleDeposit(deposit.id, key, { deductions, refundedRwf: refunded, refund });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.fieldErrors ? null : r.error);
        if (r.code === "payment_pending") setKey(crypto.randomUUID());
        return;
      }
      setDeposit(r.value);
      if (r.value.status === "settled") {
        toast.success("Deposit settled. The tenant gets the breakdown.");
        onClose();
        router.refresh();
      } else if (r.value.refundStatus === "failed") {
        setKey(crypto.randomUUID());
        setFormError(r.value.refundFailureReason ?? "The refund did not go through.");
      }
    });
  };

  if (waiting || settled) {
    return (
      <SidePanel
        isOpen
        onOpenChange={(o) => (o ? undefined : onClose())}
        title={settled ? "Deposit settled" : "Waiting for your phone"}
        description={tenantName}
        footer={<ActionButton onPress={onClose}>Close</ActionButton>}
      >
        {waiting ? (
          <div className="flex items-start gap-3 rounded-lg bg-default p-3 text-sm">
            <Icon name="Smartphone" className="mt-0.5 size-5 text-accent" />
            <p>
              Approve the prompt on your phone to send {formatMoney(deposit.refundedRwf ?? 0)} to{" "}
              {deposit.refundDestination ?? "the tenant"}. This page moves on by itself.
            </p>
          </div>
        ) : null}
        <Breakdown deposit={deposit} />
      </SidePanel>
    );
  }

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o || pending ? undefined : onClose())}
      title="Settle the deposit"
      description={`${tenantName} paid ${formatMoney(deposit.paidRwf)}${endedOn ? `, moved out ${formatDay(endedOn, "long")}` : ""}`}
      submitLabel={effective === "gateway" ? "Send refund" : "Settle deposit"}
      submitIcon={effective === "gateway" ? "Smartphone" : undefined}
      isPending={pending}
      formError={formError}
      isSubmitDisabled={Boolean(balance)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">What you keep</span>
          <ActionButton
            size="sm"
            icon="Plus"
            intent="ghost"
            isDisabled={rows.length >= 20}
            onPress={() => setRows((r) => [...r, { key: next.current++, label: "", amountRwf: null }])}
          >
            Add a deduction
          </ActionButton>
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted">Nothing kept.</p> : null}
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2">
            <TextInput
              label={<span className="sr-only">What for</span>}
              name={`deductions.${i}.label`}
              value={r.label}
              placeholder="Broken window"
              onChange={(v) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, label: v } : x)))}
              errorMessage={errors[`deductions.${i}.label`]}
            />
            <MoneyInput
              label={<span className="sr-only">Amount</span>}
              value={r.amountRwf}
              minValue={0}
              onChange={(v) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, amountRwf: v } : x)))}
              errorMessage={errors[`deductions.${i}.amountRwf`]}
            />
            <IconAction
              icon="TrashBin"
              label="Remove"
              intent="danger"
              className="mt-1"
              onPress={() => setRows((all) => all.filter((x) => x.key !== r.key))}
            />
          </div>
        ))}
      </section>

      <KeyValueList
        items={[
          { label: "Paid", value: <Money value={deposit.paidRwf} /> },
          { label: "Kept", value: <Money value={kept} /> },
          { label: "Refund", value: <Money value={refunded} className="font-semibold" /> },
        ]}
      />
      {balance ? <p className="text-sm text-danger">{balance}</p> : null}

      {refunded > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">How the refund goes back</span>
          <RadioButtonGroup
            aria-label="How the refund goes back"
            layout="grid"
            value={effective}
            onChange={(v) => setMethod(v as RefundMethod)}
            className="grid-cols-2 gap-2.5"
          >
            {(["gateway", "recorded"] as const).map((m) => (
              <RadioButtonGroup.Item key={m} value={m} className="gap-1 px-3.5 py-3">
                <RadioButtonGroup.Indicator>
                  <Icon name="CircleCheckFill" />
                </RadioButtonGroup.Indicator>
                <RadioButtonGroup.ItemContent>
                  <Label className="font-semibold">{METHOD_WORDS[m].title}</Label>
                  <Description className="text-xs">{METHOD_WORDS[m].hint}</Description>
                </RadioButtonGroup.ItemContent>
              </RadioButtonGroup.Item>
            ))}
          </RadioButtonGroup>
        </div>
      ) : null}

      {effective === "gateway" ? (
        <>
          <PhoneInput
            label="Tenant's MoMo number"
            value={tenantMomo}
            onChange={(v) => {
              setTenantMomo(v);
              setErrors((x) => ({ ...x, "refund.tenantPhone": "" }));
            }}
            errorMessage={errors["refund.tenantPhone"] || null}
            isRequired
          />
          <PhoneInput
            label="Your number, for the prompt"
            value={payer}
            onChange={(v) => {
              setPayer(v);
              setErrors((x) => ({ ...x, "refund.payerPhone": "" }));
            }}
            description="You approve the transfer on this phone."
            errorMessage={errors["refund.payerPhone"] || null}
            isRequired
          />
        </>
      ) : null}
      {effective === "recorded" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <BoundedDatePicker
            label="Paid on"
            value={paidOn}
            onChange={setPaidOn}
            minValue={endedOn}
            maxValue={today}
            errorMessage={errors["refund.paidOn"] || null}
            isRequired
          />
          <TextInput
            label="Reference"
            name="reference"
            value={reference}
            onChange={setReference}
            placeholder="Optional"
          />
        </div>
      ) : null}
    </SidePanel>
  );
}

/** What was kept, item by item, and what went back. */
export function Breakdown({ deposit }: { deposit: DepositView }) {
  const how =
    deposit.refundMethod === "gateway"
      ? `MoMo on Injishi${deposit.refundDestination ? `, ${deposit.refundDestination}` : ""}`
      : deposit.refundMethod === "recorded"
        ? `Paid outside Injishi${deposit.refundReference ? `, ${deposit.refundReference}` : ""}`
        : "No refund";
  return (
    <KeyValueList
      items={[
        { label: "Paid", value: <Money value={deposit.paidRwf} /> },
        ...deposit.deductions.map((d) => ({ label: d.label, value: <Money value={-d.amountRwf} signed /> })),
        { label: "Kept", value: <Money value={deposit.keptRwf ?? 0} /> },
        { label: "Refunded", value: <Money value={deposit.refundedRwf ?? 0} className="font-semibold" /> },
        { label: "How", value: how },
      ]}
    />
  );
}
