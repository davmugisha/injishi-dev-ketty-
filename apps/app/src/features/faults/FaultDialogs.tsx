"use client";

import { Description, Label, Spinner, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  EXPENSE_METHOD_LABEL,
  EXPENSE_RECEIPT_MAX_BYTES,
  type ExpenseMethod,
  FAULT_PAYMENT_STATUS_LABEL,
  type FaultDetail,
  type FaultPaymentView,
  faultPaymentDateProblem,
  kigaliToday,
  type MaintenanceStatus,
  type OperatorTeamMember,
  RWANDA_BANKS,
} from "@injishi/contracts";
import {
  BoundedDatePicker,
  FileField,
  FormDialog,
  formatMoney,
  Icon,
  MoneyInput,
  PhoneInput,
  SelectField,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { formOf, sendForm } from "../rentals/send-form";
import { assignFault, loadFault, moveFault, payFixer } from "./actions";
import { moveLabel } from "./shared";

const MOVE_HINT: Partial<Record<MaintenanceStatus, string>> = {
  acknowledged: "Tell the tenant you have seen it.",
  assigned: "Someone is down to fix it.",
  in_progress: "The work has started.",
  resolved: "The tenant can say it is not right for 14 days.",
  closed: "Nothing more to do.",
  wont_fix: "The tenant is told why.",
  open: "Back to Reported.",
  cancelled: "Cancel it. This is final.",
};

/** Move a fault to one of the states its chain allows from here. "Won't fix" asks why. */
export function MoveDialog({
  fault,
  onClose,
  onMoved,
}: {
  fault: FaultDetail;
  onClose: () => void;
  onMoved: (fault: FaultDetail) => void;
}) {
  const router = useRouter();
  const [to, setTo] = useState<MaintenanceStatus | null>(fault.allowedMoves[0] ?? null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (!to) {
        setErrors({ to: "Pick where it goes." });
        return;
      }
      if (to === "wont_fix" && note.trim().length < 3) {
        setErrors({ note: "Say why it won't be fixed. The tenant is told." });
        return;
      }
      const r = await moveFault(fault.id, { to, ...(note.trim() ? { note: note.trim() } : {}) });
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      toast.success(`Moved to ${moveLabel(fault.status, to)}`);
      onMoved(r.value);
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Move to"
      description={`${fault.reference ?? "Fault"}: ${fault.title}`}
      submitLabel="Move"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <RadioButtonGroup
        aria-label="Move to"
        layout="grid"
        value={to ?? ""}
        onChange={(v) => {
          setTo(v as MaintenanceStatus);
          setErrors({});
        }}
        className="grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {fault.allowedMoves.map((m) => (
          <RadioButtonGroup.Item key={m} value={m} className="gap-1 px-3.5 py-3">
            <RadioButtonGroup.Indicator>
              <Icon name="CircleCheckFill" />
            </RadioButtonGroup.Indicator>
            <RadioButtonGroup.ItemContent>
              <Label className="font-semibold">{moveLabel(fault.status, m)}</Label>
              <Description className="text-xs">{MOVE_HINT[m]}</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        ))}
      </RadioButtonGroup>
      {errors.to ? <p className="text-xs text-danger">{errors.to}</p> : null}
      <TextInput
        label={to === "wont_fix" ? "Why it won't be fixed" : "Note for the tenant"}
        name="note"
        value={note}
        onChange={(v) => {
          setNote(v);
          setErrors((e) => ({ ...e, note: "" }));
        }}
        description={to === "wont_fix" ? "The tenant reads this." : "Optional. The tenant reads it on the timeline."}
        errorMessage={errors.note || null}
        isRequired={to === "wont_fix"}
        multiline
      />
    </FormDialog>
  );
}

/** Hand the fault to someone on the team who works on faults, or to an outside fixer with their phone. */
export function AssignDialog({
  fault,
  team,
  onClose,
  onAssigned,
}: {
  fault: FaultDetail;
  /** The team, when the person may read it; null leaves only an outside fixer. */
  team: OperatorTeamMember[] | null;
  onClose: () => void;
  onAssigned: (fault: FaultDetail) => void;
}) {
  const router = useRouter();
  const members = (team ?? []).filter((m) => m.status === "active" && !m.removedAt);
  const [who, setWho] = useState<"member" | "contractor">(
    fault.assignee?.kind ?? (members.length > 0 ? "member" : "contractor"),
  );
  const [memberId, setMemberId] = useState<string | null>(fault.assignee?.userId ?? null);
  const [name, setName] = useState(fault.assignee?.kind === "contractor" ? fault.assignee.name : "");
  const [phone, setPhone] = useState<string | null>(fault.assignee?.phone ?? null);
  const [phoneText, setPhoneText] = useState(fault.assignee?.phone ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (who === "member" && !memberId) next.memberUserId = "Pick someone on your team.";
      if (who === "contractor" && name.trim().length < 2) next.contractorName = "Enter the fixer's name.";
      if (who === "contractor" && !phone)
        next.contractorPhone = phoneText.trim()
          ? "Enter a Rwandan number, like 0788 123 456."
          : "Enter the fixer's phone.";
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0) return;
      const r = await assignFault(fault.id, {
        ...(who === "member"
          ? { memberUserId: memberId }
          : { contractorName: name.trim(), contractorPhone: phone ?? phoneText }),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      toast.success(`Assigned to ${r.value.assignee?.name ?? "the fixer"}`);
      onAssigned(r.value);
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={fault.assignee ? "Change who fixes it" : "Assign"}
      description="The tenant sees the name, never the phone."
      submitLabel="Assign"
      submitIcon="PersonWorker"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {members.length > 0 ? (
        <Segment
          aria-label="Who fixes it"
          selectedKey={who}
          onSelectionChange={(k) => {
            setWho(k === "member" ? "member" : "contractor");
            setErrors({});
          }}
          className="w-fit"
        >
          <Segment.Item id="member">Someone on my team</Segment.Item>
          <Segment.Item id="contractor">An outside fixer</Segment.Item>
        </Segment>
      ) : null}
      {who === "member" ? (
        <SelectField
          label="Team member"
          name="memberUserId"
          options={members.map((m) => ({
            id: m.userId,
            label: m.name || m.email || "Team member",
            description: m.email ?? undefined,
          }))}
          value={memberId}
          onChange={(v) => {
            setMemberId(v);
            setErrors({});
          }}
          placeholder="Pick someone"
          errorMessage={errors.memberUserId || null}
          isRequired
        />
      ) : (
        <>
          <TextInput
            label="Fixer's name"
            name="contractorName"
            value={name}
            onChange={(v) => {
              setName(v);
              setErrors((e) => ({ ...e, contractorName: "" }));
            }}
            placeholder="Eric the plumber"
            errorMessage={errors.contractorName || null}
            isRequired
          />
          <PhoneInput
            label="Fixer's phone"
            name="contractorPhone"
            value={phone}
            onChange={(e164, text) => {
              setPhone(e164);
              setPhoneText(text);
              setErrors((e) => ({ ...e, contractorPhone: "" }));
            }}
            errorMessage={errors.contractorPhone || null}
            isRequired
          />
        </>
      )}
      <TextInput
        label="Note"
        name="note"
        value={note}
        onChange={setNote}
        description="Optional. On the timeline."
        multiline
      />
    </FormDialog>
  );
}

type PayWay = "gateway" | "recorded";
type PayTo = "mtn" | "airtel" | "bank";

const PAY_TO: { id: PayTo; title: string; hint: string }[] = [
  { id: "mtn", title: "MTN MoMo", hint: "078 or 079" },
  { id: "airtel", title: "Airtel Money", hint: "072 or 073" },
  { id: "bank", title: "Bank", hint: "Account number" },
];

const METHODS = (Object.keys(EXPENSE_METHOD_LABEL) as ExpenseMethod[]).map((id) => ({
  id,
  label: EXPENSE_METHOD_LABEL[id],
}));

/**
 * Pay the fixer: through Injishi (a prompt on the landlord's own phone, then the money to the fixer's
 * MoMo, Airtel Money or bank account, waiting until it settles), or write down a payment made outside
 * Injishi with its day, method and receipt. Either becomes a repairs expense.
 */
export function PayFixerDialog({
  fault,
  onClose,
  onChanged,
}: {
  fault: FaultDetail;
  onClose: () => void;
  onChanged: (fault: FaultDetail) => void;
}) {
  const router = useRouter();
  const today = kigaliToday();
  const contractor = fault.assignee?.kind === "contractor" ? fault.assignee : null;
  const [way, setWay] = useState<PayWay>("gateway");
  const [amount, setAmount] = useState<number | null>(null);
  const [payee, setPayee] = useState(fault.assignee?.name ?? "");
  const [to, setTo] = useState<PayTo | null>(contractor?.phone ? "mtn" : null);
  const [payeePhone, setPayeePhone] = useState<string | null>(contractor?.phone ?? null);
  const [payeePhoneText, setPayeePhoneText] = useState(contractor?.phone ?? "");
  const [bank, setBank] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [payer, setPayer] = useState<string | null>(null);
  const [payerText, setPayerText] = useState("");
  const [paidOn, setPaidOn] = useState<string | null>(today);
  const [method, setMethod] = useState<ExpenseMethod>("cash");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [watching, setWatching] = useState<FaultPaymentView | null>(null);
  const key = useRef(crypto.randomUUID());

  // Wait for the prompt to be approved and the money to land with the fixer.
  useEffect(() => {
    if (watching?.status !== "waiting") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await loadFault(fault.id);
      if (!live) return;
      if (r.ok) {
        const now = r.value.payments?.find((p) => p.id === watching.id);
        if (now && now.status !== "waiting") {
          setWatching(now);
          onChanged(r.value);
          router.refresh();
          return;
        }
      }
      timer = setTimeout(tick, 2000);
    };
    timer = setTimeout(tick, 2000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [watching, fault.id, onChanged, router]);

  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));

  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (!amount || amount <= 0) next.amountRwf = "Enter the amount.";
      if (payee.trim().length < 2)
        next.payeeName = way === "gateway" ? "Enter who you are paying." : "Enter who was paid.";
      if (way === "gateway") {
        if (amount && amount < 100) next.amountRwf = "Pay at least RWF 100.";
        if (!to) next.to = "Pick where the money goes.";
        if ((to === "mtn" || to === "airtel") && !payeePhone) next["payee.phone"] = "Enter the fixer's number.";
        if (to === "bank" && !bank) next["payee.bankName"] = "Pick the bank.";
        if (to === "bank" && account.trim().length < 5) next["payee.accountNumber"] = "Enter the account number.";
        if (!payer) next.payerPhone = payerText.trim() ? "Enter an MTN or Airtel number." : "Enter your own number.";
      } else {
        const why = paidOn ? faultPaymentDateProblem(paidOn, fault.reportedOn, today) : "Pick the day it was paid.";
        if (why) next.paidOn = why;
      }
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0) return;

      if (way === "gateway") {
        const r = await payFixer(fault.id, key.current, {
          amountRwf: amount,
          payeeName: payee.trim(),
          payee:
            to === "bank"
              ? { kind: "bank", bankName: bank, accountNumber: account.trim() }
              : { kind: "momo", phone: payeePhone ?? payeePhoneText },
          payerPhone: payer ?? payerText,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (!r.ok) {
          const fields = fieldErrorsOnly(r.fieldErrors);
          setErrors(fields);
          setFormError(Object.keys(fields).length > 0 ? null : r.error);
          return;
        }
        onChanged(r.value);
        const made =
          r.value.payments?.find((p) => p.source === "gateway" && p.status === "waiting") ??
          r.value.payments?.find((p) => p.source === "gateway") ??
          null;
        setWatching(made);
        router.refresh();
        return;
      }

      const r = await sendForm<FaultDetail>(
        `/api/rentals/forms/faults/${fault.id}/payments/recorded`,
        "POST",
        formOf(
          {
            amountRwf: amount,
            paidOn,
            method,
            payeeName: payee.trim(),
            payeePhone: payeePhone ?? undefined,
            note: note.trim(),
          },
          ["receipt", receipt],
        ),
      );
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      toast.success(`${formatMoney(amount ?? 0)} to ${payee.trim()} recorded`);
      onChanged(r.value);
      router.refresh();
      onClose();
    });

  if (watching) {
    const status = watching.status;
    return (
      <FormDialog
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={status === "paid" ? "Fixer paid" : status === "waiting" ? "Approve on your phone" : "Not paid"}
        description={`${formatMoney(watching.amountRwf)} to ${watching.payeeName ?? payee}${watching.destination ? `, ${watching.destination}` : ""}`}
        submitLabel={status === "waiting" ? "Waiting" : status === "paid" ? "Done" : "Try again"}
        submitIcon={status === "failed" ? "ArrowRotateRight" : undefined}
        isSubmitDisabled={status === "waiting"}
        cancelLabel="Close"
        size="sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (status === "failed") {
            key.current = crypto.randomUUID();
            setWatching(null);
            return;
          }
          onClose();
        }}
      >
        <div className="flex items-start gap-3" aria-live="polite">
          <span
            className={
              status === "paid"
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                : status === "waiting"
                  ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                  : "flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
            }
          >
            {status === "waiting" ? (
              <Spinner size="sm" color="current" />
            ) : (
              <Icon name={status === "paid" ? "CircleCheck" : "CircleXmark"} className="size-5" />
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold">{FAULT_PAYMENT_STATUS_LABEL[status]}</span>
            <span className="text-sm text-pretty text-muted">
              {status === "waiting"
                ? "Enter your PIN on your phone. The money goes to the fixer once you approve. This updates by itself."
                : status === "paid"
                  ? "It is in your expenses as a repair."
                  : (watching.failureReason ?? "Nothing was taken from you.")}
            </span>
          </div>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Pay the fixer"
      description="It goes into your expenses as a repair."
      submitLabel={way === "gateway" ? (amount ? `Pay ${formatMoney(amount)}` : "Pay") : "Record the payment"}
      submitIcon={way === "gateway" ? "Wallet" : "Receipt"}
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      footerHint={way === "gateway" ? "A prompt goes to your phone. Injishi takes no fee." : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Segment
        aria-label="How you pay"
        selectedKey={way}
        onSelectionChange={(k) => {
          setWay(k === "recorded" ? "recorded" : "gateway");
          setErrors({});
          setFormError(null);
        }}
        className="w-fit"
      >
        <Segment.Item id="gateway">Pay through Injishi</Segment.Item>
        <Segment.Item id="recorded">Paid outside Injishi</Segment.Item>
      </Segment>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label="Amount"
          name="amountRwf"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            clear("amountRwf");
          }}
          minValue={1}
          errorMessage={errors.amountRwf || null}
          isRequired
        />
        <TextInput
          label={way === "gateway" ? "Paying" : "Paid to"}
          name="payeeName"
          value={payee}
          onChange={(v) => {
            setPayee(v);
            clear("payeeName");
          }}
          errorMessage={errors.payeeName || null}
          isRequired
        />
      </div>
      {way === "gateway" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Send it to</span>
            <RadioButtonGroup
              aria-label="Send it to"
              layout="grid"
              value={to ?? ""}
              onChange={(v) => {
                setTo(v as PayTo);
                clear("to");
              }}
              className="grid-cols-3 gap-2"
            >
              {PAY_TO.map((p) => (
                <RadioButtonGroup.Item key={p.id} value={p.id} className="gap-1 px-3 py-2.5">
                  <RadioButtonGroup.Indicator>
                    <Icon name="CircleCheckFill" />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent>
                    <Label className="font-semibold">{p.title}</Label>
                    <Description className="text-xs">{p.hint}</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            {errors.to ? <p className="text-xs text-danger">{errors.to}</p> : null}
          </div>
          {to === "bank" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Bank"
                name="payee.bankName"
                options={RWANDA_BANKS}
                value={bank}
                onChange={(v) => {
                  setBank(v);
                  clear("payee.bankName");
                }}
                placeholder="Pick the bank"
                errorMessage={errors["payee.bankName"] || null}
                isRequired
              />
              <TextInput
                label="Account number"
                name="payee.accountNumber"
                value={account}
                onChange={(v) => {
                  setAccount(v);
                  clear("payee.accountNumber");
                }}
                inputMode="numeric"
                errorMessage={errors["payee.accountNumber"] || null}
                isRequired
              />
            </div>
          ) : to ? (
            <PhoneInput
              label="Fixer's number"
              name="payee.phone"
              value={payeePhone}
              onChange={(e164, text) => {
                setPayeePhone(e164);
                setPayeePhoneText(text);
                clear("payee.phone");
              }}
              errorMessage={errors["payee.phone"] || null}
              isRequired
            />
          ) : null}
          <PhoneInput
            label="Your number"
            name="payerPhone"
            value={payer}
            onChange={(e164, text) => {
              setPayer(e164);
              setPayerText(text);
              clear("payerPhone");
            }}
            description="Your MTN or Airtel number. The prompt to approve goes here."
            errorMessage={errors.payerPhone || null}
            isRequired
          />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <BoundedDatePicker
              label="Paid on"
              name="paidOn"
              value={paidOn}
              onChange={(v) => {
                setPaidOn(v);
                clear("paidOn");
              }}
              minValue={fault.reportedOn}
              maxValue={today}
              unavailableMessage="Pick a day from the report to today."
              errorMessage={errors.paidOn || null}
              isRequired
            />
            <SelectField
              label="How"
              name="method"
              options={METHODS}
              value={method}
              onChange={(v) => setMethod(v as ExpenseMethod)}
            />
          </div>
          <FileField
            label="Receipt"
            value={receipt}
            onChange={setReceipt}
            maxBytes={EXPENSE_RECEIPT_MAX_BYTES}
            buttonLabel="Attach the receipt"
            description="Optional. A PDF or a photo, up to 10 MB."
            errorMessage={errors.receipt || null}
          />
        </>
      )}
      <TextInput label="Note" name="note" value={note} onChange={setNote} description="Optional." multiline />
    </FormDialog>
  );
}
