"use client";

import { toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_METHOD_LABEL,
  EXPENSE_RECEIPT_MAX_BYTES,
  type ExpenseCategory,
  type ExpenseMethod,
  type ExpenseView,
  kigaliToday,
  LOAN_PURPOSE_LABEL,
  type LoanPurpose,
} from "@injishi/contracts";
import {
  BoundedDatePicker,
  FileField,
  FormDialog,
  formatDay,
  formatMoney,
  MoneyInput,
  PhoneInput,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { formOf, sendForm } from "../rentals/send-form";
import { voidExpense } from "./actions";

const CATEGORIES = (Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((id) => ({
  id,
  label: EXPENSE_CATEGORY_LABEL[id],
}));
const METHODS = (Object.keys(EXPENSE_METHOD_LABEL) as ExpenseMethod[]).map((id) => ({
  id,
  label: EXPENSE_METHOD_LABEL[id],
}));
const WHOLE = "whole";

/** Write down money spent on the property, paid outside Injishi, with its receipt. */
export function AddExpensePanel({
  properties,
  units,
  onClose,
}: {
  properties: { id: string; name: string }[];
  units: { id: string; label: string; propertyId: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = kigaliToday();
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [paidOn, setPaidOn] = useState<string | null>(today);
  const [method, setMethod] = useState<ExpenseMethod | null>(null);
  const [payee, setPayee] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(
    properties.length === 1 ? (properties[0]?.id ?? null) : null,
  );
  const [unitId, setUnitId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<LoanPurpose | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const loan = category === "loan_interest";
  const unitsHere = units.filter((u) => !propertyId || u.propertyId === propertyId);
  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));

  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (!category) next.category = "Pick what it was for.";
      if (!amount || amount <= 0) next.amountRwf = "Enter the amount.";
      if (!paidOn) next.paidOn = "Pick the day it was paid.";
      if (!method) next.method = "Say how it was paid.";
      if (loan && !purpose) next.loanPurpose = "Say what the loan was for.";
      if (loan && payee.trim().length < 2) next.payeeName = "Name the bank or lender.";
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0) return;
      const r = await sendForm<ExpenseView>(
        "/api/rentals/forms/expenses",
        "POST",
        formOf(
          {
            category,
            amountRwf: amount,
            paidOn,
            method,
            payeeName: payee.trim(),
            payeePhone: phone ?? undefined,
            note: note.trim(),
            propertyId: propertyId && propertyId !== WHOLE ? propertyId : undefined,
            unitId: unitId ?? undefined,
            loanPurpose: loan ? purpose : undefined,
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
      toast.success(
        `${formatMoney(r.value.amountRwf)} for ${EXPENSE_CATEGORY_LABEL[r.value.category].toLowerCase()} added`,
      );
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Add an expense"
      submitLabel="Add expense"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto [&>*]:shrink-0">
        <SelectField
          label="What for"
          name="category"
          options={CATEGORIES}
          value={category}
          onChange={(v) => {
            setCategory(v as ExpenseCategory);
            clear("category");
            if (v !== "loan_interest") setPurpose(null);
          }}
          placeholder="Pick one"
          errorMessage={errors.category || null}
          isRequired
        />
        {loan ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">The loan was</span>
            <Segment
              aria-label="The loan was"
              selectedKey={purpose ?? ""}
              onSelectionChange={(k) => {
                setPurpose(k === "buy" ? "buy" : "build");
                clear("loanPurpose");
              }}
              className="w-fit"
            >
              <Segment.Item id="build">{LOAN_PURPOSE_LABEL.build}</Segment.Item>
              <Segment.Item id="buy">{LOAN_PURPOSE_LABEL.buy}</Segment.Item>
            </Segment>
            {errors.loanPurpose ? (
              <p className="text-xs text-danger">{errors.loanPurpose}</p>
            ) : (
              <p className="text-xs text-muted">
                Bank interest on it lowers your rental income tax. Attach the bank statement.
              </p>
            )}
          </div>
        ) : null}
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
          <BoundedDatePicker
            label="Paid on"
            name="paidOn"
            value={paidOn}
            onChange={(v) => {
              setPaidOn(v);
              clear("paidOn");
            }}
            minValue="2000-01-01"
            maxValue={today}
            unavailableMessage="Pick a day up to today."
            errorMessage={errors.paidOn || null}
            isRequired
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={loan ? "Bank or lender" : "Paid to"}
            name="payeeName"
            value={payee}
            onChange={(v) => {
              setPayee(v);
              clear("payeeName");
            }}
            placeholder={loan ? "Bank of Kigali" : "Optional"}
            errorMessage={errors.payeeName || null}
            isRequired={loan}
          />
          <SelectField
            label="How"
            name="method"
            options={METHODS}
            value={method}
            onChange={(v) => {
              setMethod(v as ExpenseMethod);
              clear("method");
            }}
            errorMessage={errors.method || null}
            isRequired
          />
        </div>
        {!loan ? (
          <PhoneInput
            label="Their phone"
            name="payeePhone"
            value={phone}
            onChange={(e164) => {
              setPhone(e164);
              clear("payeePhone");
            }}
            description="Optional."
            errorMessage={errors.payeePhone || null}
          />
        ) : null}
        {properties.length > 1 ? (
          <SelectField
            label="Building"
            name="propertyId"
            options={[
              { id: WHOLE, label: "The whole business" },
              ...properties.map((p) => ({ id: p.id, label: p.name })),
            ]}
            value={propertyId ?? WHOLE}
            onChange={(v) => {
              setPropertyId(v === WHOLE ? null : v);
              setUnitId(null);
            }}
            errorMessage={errors.propertyId || null}
          />
        ) : null}
        {!loan && unitsHere.length > 0 ? (
          <SelectField
            label="Unit"
            name="unitId"
            options={[
              { id: WHOLE, label: "Not for one unit" },
              ...unitsHere.map((u) => ({ id: u.id, label: u.label })),
            ]}
            value={unitId ?? WHOLE}
            onChange={(v) => setUnitId(v === WHOLE ? null : v)}
            errorMessage={errors.unitId || null}
          />
        ) : null}
        <FileField
          label="Receipt"
          value={receipt}
          onChange={setReceipt}
          maxBytes={EXPENSE_RECEIPT_MAX_BYTES}
          buttonLabel={loan ? "Attach the bank statement" : "Attach the receipt"}
          description="A PDF or a photo, up to 10 MB."
          errorMessage={errors.receipt || null}
        />
        <TextInput label="Note" name="note" value={note} onChange={setNote} description="Optional." multiline />
      </div>
    </SidePanel>
  );
}

/** Strike an expense out, with the reason kept. One paid through Injishi can't be voided. */
export function VoidExpenseDialog({ expense, onClose }: { expense: ExpenseView; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (reason.trim().length < 3) {
        setError("Say why it is voided.");
        return;
      }
      const r = await voidExpense(expense.id, reason.trim());
      if (!r.ok) {
        setError(r.fieldErrors?.reason ?? r.error);
        return;
      }
      toast.success("Expense voided");
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Void this expense?"
      description={`${formatMoney(expense.amountRwf)}, ${EXPENSE_CATEGORY_LABEL[expense.category].toLowerCase()}, ${formatDay(expense.paidOn, "long")}. It stays listed, struck out, and stops counting.`}
      size="sm"
      submitLabel="Void it"
      cancelLabel="Keep it"
      isPending={pending}
      validationErrors={error ? { reason: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextInput
        label="Why"
        name="reason"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        placeholder="Entered twice"
        errorMessage={error}
        isRequired
        multiline
        autoFocus
      />
    </FormDialog>
  );
}

/** Attach the receipt to an expense written down without one. */
export function ReceiptDialog({ expense, onClose }: { expense: ExpenseView; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (!file) {
        setError("Pick the file.");
        return;
      }
      const form = new FormData();
      form.append("receipt", file, file.name);
      const r = await sendForm<ExpenseView>(`/api/rentals/forms/expenses/${expense.id}/receipt`, "POST", form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Receipt attached");
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Attach the receipt"
      description={`${formatMoney(expense.amountRwf)}, ${formatDay(expense.paidOn, "long")}`}
      size="sm"
      submitLabel="Attach"
      isPending={pending}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FileField
        label="Receipt"
        value={file}
        onChange={(f) => {
          setFile(f);
          setError(null);
        }}
        maxBytes={EXPENSE_RECEIPT_MAX_BYTES}
        description="A PDF or a photo, up to 10 MB."
        errorMessage={error}
      />
    </FormDialog>
  );
}
