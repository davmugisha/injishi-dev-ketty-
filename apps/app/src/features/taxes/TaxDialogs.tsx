"use client";

import { Description, Label, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  declarationDateProblem,
  FILING_PROOF_MAX_BYTES,
  kigaliToday,
  type LeaseFilingView,
  leaseFilingDateProblem,
  TAX_DECLARATION_STATUS_LABEL,
  TAX_RECEIPT_MAX_BYTES,
  type TaxDeclarationStatus,
  type TaxpayerKind,
  type TaxYearView,
} from "@injishi/contracts";
import {
  ActionButton,
  BoundedDatePicker,
  FileField,
  FormDialog,
  formatDay,
  Icon,
  MoneyInput,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { formOf, sendForm } from "../rentals/send-form";
import { setTaxpayer } from "./actions";

const KINDS: { id: TaxpayerKind; title: string; hint: string }[] = [
  { id: "individual", title: "As a person", hint: "Rental income tax: 50% off, then bands" },
  { id: "company", title: "As a company", hint: "Corporate income tax on profit" },
];

/** Person or company: the choice the whole page follows. */
export function TaxpayerChoice({
  value,
  onDone,
  inDialog,
}: {
  value: TaxpayerKind | null;
  onDone?: () => void;
  inDialog?: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<TaxpayerKind | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      if (!kind) {
        setError("Pick one.");
        return;
      }
      const r = await setTaxpayer(kind);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(kind === "company" ? "Saved: you let as a company" : "Saved: you let as a person");
      onDone?.();
      router.refresh();
    });
  const choices = (
    <>
      <RadioButtonGroup
        aria-label="You let as"
        layout="grid"
        value={kind ?? ""}
        onChange={(v) => {
          setKind(v as TaxpayerKind);
          setError(null);
        }}
        className="grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {KINDS.map((k) => (
          <RadioButtonGroup.Item key={k.id} value={k.id} className="gap-1 px-3.5 py-3">
            <RadioButtonGroup.Indicator>
              <Icon name="CircleCheckFill" />
            </RadioButtonGroup.Indicator>
            <RadioButtonGroup.ItemContent>
              <Label className="font-semibold">{k.title}</Label>
              <Description className="text-xs">{k.hint}</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        ))}
      </RadioButtonGroup>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </>
  );
  if (inDialog) {
    return (
      <FormDialog
        isOpen
        onOpenChange={(open) => (open ? undefined : onDone?.())}
        title="You let as"
        submitLabel="Save"
        isPending={pending}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {choices}
      </FormDialog>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {choices}
      <ActionButton type="submit" intent="primary" isPending={pending} className="self-start">
        Save
      </ActionButton>
    </form>
  );
}

/**
 * Where the year's declaration stands, as the landlord tells it (they declare and pay on RRA's portal):
 * not declared, declared on a day, or paid with the amount, RRA's reference and receipt.
 */
export function DeclarationPanel({ view, onClose }: { view: TaxYearView; onClose: () => void }) {
  const router = useRouter();
  const today = kigaliToday();
  const d = view.declaration;
  const [status, setStatus] = useState<TaxDeclarationStatus>(d.status === "not_started" ? "declared" : d.status);
  const [declaredOn, setDeclaredOn] = useState<string | null>(d.declaredOn ?? today);
  const [paidOn, setPaidOn] = useState<string | null>(d.paidOn ?? today);
  const [amount, setAmount] = useState<number | null>(d.amountPaidRwf ?? view.rentalTax?.taxRwf ?? null);
  const [reference, setReference] = useState(d.rraReference ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const firstDay = `${view.year + 1}-01-01`;
  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));

  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (status !== "not_started") {
        const why = declaredOn
          ? declarationDateProblem(declaredOn, view.year, { today })
          : "Pick the day you declared.";
        if (why) next.declaredOn = why;
      }
      if (status === "paid") {
        const why = paidOn
          ? declarationDateProblem(paidOn, view.year, { today, notBefore: declaredOn })
          : "Pick the day you paid.";
        if (why) next.paidOn = why;
        if (amount === null || amount <= 0) next.amountPaidRwf = "Enter the amount paid.";
      }
      setErrors(next);
      setFormError(null);
      if (Object.keys(next).length > 0) return;
      const r = await sendForm<TaxYearView>(
        `/api/rentals/forms/taxes/${view.year}/declaration`,
        "PUT",
        formOf(
          {
            status,
            declaredOn: status !== "not_started" ? declaredOn : undefined,
            paidOn: status === "paid" ? paidOn : undefined,
            amountPaidRwf: status === "paid" ? amount : undefined,
            rraReference: status !== "not_started" ? reference.trim() : undefined,
          },
          ["receipt", status === "paid" ? receipt : null],
        ),
      );
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      toast.success(`${view.year}: ${TAX_DECLARATION_STATUS_LABEL[status].toLowerCase()}`);
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`${view.year} declaration`}
      description={`Due by ${formatDay(view.dueOn, "long")} on RRA's portal`}
      submitLabel="Save"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto [&>*]:shrink-0">
        <Segment
          aria-label="Where it stands"
          selectedKey={status}
          onSelectionChange={(k) => {
            setStatus(k as TaxDeclarationStatus);
            setErrors({});
          }}
          className="w-fit"
        >
          <Segment.Item id="not_started">{TAX_DECLARATION_STATUS_LABEL.not_started}</Segment.Item>
          <Segment.Item id="declared">{TAX_DECLARATION_STATUS_LABEL.declared}</Segment.Item>
          <Segment.Item id="paid">{TAX_DECLARATION_STATUS_LABEL.paid}</Segment.Item>
        </Segment>
        {status !== "not_started" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <BoundedDatePicker
                label="Declared on"
                name="declaredOn"
                value={declaredOn}
                onChange={(v) => {
                  setDeclaredOn(v);
                  clear("declaredOn");
                }}
                minValue={firstDay}
                maxValue={today}
                unavailableMessage={`Pick a day from 1 January ${view.year + 1} to today.`}
                errorMessage={errors.declaredOn || null}
                isRequired
              />
              <TextInput
                label="RRA reference"
                name="rraReference"
                value={reference}
                onChange={(v) => {
                  setReference(v);
                  clear("rraReference");
                }}
                placeholder="Optional"
                errorMessage={errors.rraReference || null}
              />
            </div>
            {status === "paid" ? (
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
                    minValue={declaredOn ?? firstDay}
                    maxValue={today}
                    unavailableMessage="Pick a day from the declaration to today."
                    errorMessage={errors.paidOn || null}
                    isRequired
                  />
                  <MoneyInput
                    label="Amount paid"
                    name="amountPaidRwf"
                    value={amount}
                    onChange={(v) => {
                      setAmount(v);
                      clear("amountPaidRwf");
                    }}
                    minValue={1}
                    errorMessage={errors.amountPaidRwf || null}
                    isRequired
                  />
                </div>
                <FileField
                  label="RRA's receipt"
                  value={receipt}
                  onChange={setReceipt}
                  maxBytes={TAX_RECEIPT_MAX_BYTES}
                  buttonLabel="Attach the receipt"
                  description={
                    d.receiptUrl ? "One is attached. A new file replaces it." : "Optional. A PDF or a photo."
                  }
                  errorMessage={errors.receipt || null}
                />
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Nothing is kept. Mark it declared once you have.</p>
        )}
      </div>
    </SidePanel>
  );
}

/** RRA has the lease copy: the day it was filed, RRA's reference and the proof. */
export function MarkFiledDialog({ filing, onClose }: { filing: LeaseFilingView; onClose: () => void }) {
  const router = useRouter();
  const today = kigaliToday();
  const notBefore = filing.signedOn ?? "2000-01-01";
  const [filedOn, setFiledOn] = useState<string | null>(today);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const why = filedOn ? leaseFilingDateProblem(filedOn, notBefore, today) : "Pick the day you filed it.";
      setErrors(why ? { filedOn: why } : {});
      setFormError(null);
      if (why) return;
      const r = await sendForm<LeaseFilingView>(
        `/api/rentals/forms/filings/${filing.id}/filed`,
        "POST",
        formOf({ filedOn, reference: reference.trim() }, ["proof", proof]),
      );
      if (!r.ok) {
        const fields = fieldErrorsOnly(r.fieldErrors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : r.error);
        return;
      }
      toast.success(`Lease ${filing.leaseReference} marked filed`);
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Mark ${filing.leaseReference} filed`}
      description={`${filing.tenantName}, unit ${filing.unitLabel}. Due by ${formatDay(filing.dueOn, "long")}.`}
      submitLabel="Mark filed"
      submitIcon="FileCheck"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <BoundedDatePicker
          label="Filed on"
          name="filedOn"
          value={filedOn}
          onChange={(v) => {
            setFiledOn(v);
            setErrors({});
          }}
          minValue={notBefore}
          maxValue={today}
          unavailableMessage="Pick a day from the signing to today."
          errorMessage={errors.filedOn || null}
          isRequired
        />
        <TextInput
          label="RRA reference"
          name="reference"
          value={reference}
          onChange={setReference}
          placeholder="Optional"
          errorMessage={errors.reference || null}
        />
      </div>
      <FileField
        label="Proof"
        value={proof}
        onChange={setProof}
        maxBytes={FILING_PROOF_MAX_BYTES}
        buttonLabel="Attach the proof"
        description="Optional. RRA's acknowledgement, a PDF or a photo."
        errorMessage={errors.proof || null}
      />
    </FormDialog>
  );
}
