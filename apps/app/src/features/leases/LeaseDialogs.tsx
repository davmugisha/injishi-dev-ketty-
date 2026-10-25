"use client";

import { Alert, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import {
  type IdKind,
  LEASE_PAYMENT_METHOD_LABEL,
  type LeaseDetail,
  RecordedPaymentMethod,
  RWANDA_CODE,
} from "@injishi/contracts";
import {
  BoundedDatePicker,
  EmailInput,
  FormDialog,
  formatMoney,
  Icon,
  MoneyInput,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { cancelLease, editLease, recordLeasePayment, resendInvitation } from "./actions";
import {
  OccupantsFields,
  occupantProblems,
  type TenantDraft,
  TenantFields,
  type TermsDraft,
  TermsFields,
  tenantBody,
  tenantProblems,
  termsBody,
  termsOf,
  termsProblems,
} from "./LeaseForm";

function Warning({ children }: { children: string }) {
  return (
    <Alert status="warning">
      <Alert.Indicator>
        <Icon name="TriangleExclamation" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title className="text-sm text-pretty">{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/** Email the invitation again, or to a corrected address (which takes the lease back to draft). */
export function ResendDialog({ lease, onClose }: { lease: LeaseDetail; onClose: () => void }) {
  const router = useRouter();
  const current = lease.invitation?.email ?? lease.tenant.email ?? "";
  const [email, setEmail] = useState(current);
  const [keep, setKeep] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changing = email.trim().toLowerCase() !== current.trim().toLowerCase();
  const submit = () =>
    start(async () => {
      const result = await resendInvitation(
        lease.id,
        changing ? { email: email.trim(), ...(keep ? { confirmEmail: true } : {}) } : {},
      );
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(changing ? "Address changed. Sign the lease again to send it." : `Invitation sent to ${current}`);
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Resend the invitation"
      description="A fresh link goes out; the one sent before stops working."
      submitLabel={changing ? "Change the address" : "Send it again"}
      submitIcon="PaperPlane"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <EmailInput
        label="Tenant's email"
        name="email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          setKeep(false);
        }}
        onTypoChange={(t) => setKeep(t.kept)}
        errorMessage={errors.email}
        isRequired
      />
      {changing ? (
        <Warning>
          The address is part of the contract. Changing it takes the lease back to draft: you sign again, and the
          invitation goes to the new address.
        </Warning>
      ) : null}
    </FormDialog>
  );
}

/** Cancel a lease that never started, with the reason kept on its record. */
export function CancelDialog({ lease, onClose }: { lease: LeaseDetail; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (reason.trim().length < 3) {
        setError("Say why the lease is cancelled.");
        return;
      }
      const result = await cancelLease(lease.id, reason.trim());
      if (!result.ok) {
        setError(result.fieldErrors?.reason ?? result.error);
        return;
      }
      toast.success(`Lease ${lease.reference} cancelled`);
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Cancel lease ${lease.reference}?`}
      description={
        lease.status === "draft"
          ? "The draft is kept on file, cancelled. The unit stays free."
          : "The tenant can no longer sign it and the unit is free again. This can't be undone."
      }
      size="sm"
      submitLabel="Cancel the lease"
      cancelLabel="Keep it"
      isPending={pending}
      validationErrors={error ? { reason: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        name="reason"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        isRequired
        isInvalid={error ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>Why</Label>
        <TextArea rows={3} placeholder="The tenant changed their mind" />
        <FieldError>{error}</FieldError>
      </TextField>
    </FormDialog>
  );
}

const METHOD_OPTIONS = RecordedPaymentMethod.options.map((m) => ({ id: m, label: LEASE_PAYMENT_METHOD_LABEL[m] }));

/** Rent the landlord already received outside Injishi: it pays the oldest open charges first. */
export function RecordPaymentDialog({
  lease,
  today,
  onClose,
}: {
  lease: LeaseDetail;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const owed = Math.max(0, lease.charges.balanceRwf);
  const [method, setMethod] = useState<string>("cash");
  const [amount, setAmount] = useState<number | null>(owed > 0 ? owed : null);
  const [receivedOn, setReceivedOn] = useState<string | null>(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const next: Record<string, string> = {};
      if (!amount || amount <= 0) next.amountRwf = "Enter the amount received.";
      if (!receivedOn) next.receivedOn = "Pick the day it was received.";
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      const result = await recordLeasePayment({
        leaseId: lease.id,
        method,
        amountRwf: amount,
        receivedOn,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(`${formatMoney(result.value.amountRwf)} recorded`);
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Record a payment"
      description="Money you received yourself: cash, a transfer, MoMo to your own number."
      submitLabel="Record payment"
      submitIcon="Wallet"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      footerHint={owed > 0 ? `${formatMoney(owed)} is owed now. It pays the oldest charges first.` : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label="Amount"
          name="amountRwf"
          value={amount}
          onChange={setAmount}
          minValue={1}
          errorMessage={errors.amountRwf}
          isRequired
        />
        <BoundedDatePicker
          label="Received on"
          name="receivedOn"
          value={receivedOn}
          onChange={setReceivedOn}
          minValue={lease.terms.startDate}
          maxValue={today}
          errorMessage={errors.receivedOn}
          isRequired
        />
      </div>
      <SelectField
        label="How"
        name="method"
        options={METHOD_OPTIONS}
        value={method}
        onChange={setMethod}
        errorMessage={errors.method}
      />
      <TextInput
        label="Reference"
        name="reference"
        value={reference}
        onChange={setReference}
        description="The slip or MoMo reference, if there is one."
        errorMessage={errors.reference}
      />
      <TextInput label="Note" name="note" value={note} onChange={setNote} multiline errorMessage={errors.note} />
    </FormDialog>
  );
}

/** Only what changed, so an edit never resets what the person did not touch. */
function changedTerms(before: TermsDraft, after: TermsDraft): Record<string, unknown> {
  const a = termsBody(before);
  const b = termsBody(after);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(b) as (keyof typeof b)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out[key] = b[key];
  }
  return out;
}

function tenantDraftOf(lease: LeaseDetail): TenantDraft {
  const t = lease.tenant;
  return {
    fullName: t.fullName,
    email: t.email ?? "",
    keepEmail: false,
    phone: t.phone,
    phoneText: t.phone ?? "",
    idKind: (t.idKind ?? "national_id") as IdKind,
    idNumber: t.idNumber ?? "",
    nationality: t.nationality ?? RWANDA_CODE,
  };
}

/** Change a lease before the tenant signs: the terms, who lives there, and the tenant's details. */
export function EditLeasePanel({
  lease,
  today,
  autoStart,
  onClose,
}: {
  lease: LeaseDetail;
  today: string;
  autoStart: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [before] = useState(() => termsOf(lease.terms));
  const [terms, setTerms] = useState(before);
  const [tenantBefore] = useState(() => tenantDraftOf(lease));
  const [tenant, setTenant] = useState(tenantBefore);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canEditTenant = lease.tenant.editable;

  const submit = () =>
    start(async () => {
      const problems: Record<string, string> = {
        ...termsProblems(terms, today, { isNew: false }),
        ...occupantProblems(terms),
      };
      const tenantChanges: Record<string, unknown> = {};
      if (canEditTenant) {
        const now = tenantBody(tenant);
        const was = tenantBody(tenantBefore);
        for (const key of Object.keys(now) as (keyof typeof now)[])
          if (now[key] !== was[key]) tenantChanges[key] = now[key];
        if (Object.keys(tenantChanges).length > 0) {
          for (const [k, v] of Object.entries(tenantProblems(tenant))) problems[`tenant.${k}`] = v;
        }
      }
      setErrors(problems);
      if (Object.keys(problems).length > 0) {
        setFormError(problems["tenant.emailTypo"] ? "Use the suggested email, or keep it as typed." : null);
        return;
      }
      const termChanges = changedTerms(before, terms);
      if (Object.keys(termChanges).length === 0 && Object.keys(tenantChanges).length === 0) {
        setFormError("Nothing changed.");
        return;
      }
      const result = await editLease(lease.id, {
        ...(Object.keys(termChanges).length > 0 ? { terms: termChanges } : {}),
        ...(Object.keys(tenantChanges).length > 0 ? { tenant: tenantChanges } : {}),
        ...(tenant.keepEmail && tenantChanges.email ? { confirmEmail: true } : {}),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(
          result.fieldErrors && Object.keys(fieldErrorsOnly(result.fieldErrors)).length > 0 ? null : result.error,
        );
        return;
      }
      toast.success(lease.status === "pending_signature" ? "Saved. Sign the lease again to send it." : "Lease saved");
      onClose();
      router.refresh();
    });

  const tenantErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith("tenant."))
      .map(([k, v]) => [k.slice(7), v]),
  );
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Edit lease ${lease.reference}`}
      description={`Unit ${lease.unit.label} · ${lease.tenant.fullName}`}
      submitLabel="Save"
      isPending={pending}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {lease.status === "pending_signature" ? (
        <Warning>
          The tenant has not signed yet. Saving a change voids your signature: you sign again, and the tenant gets a new
          invitation.
        </Warning>
      ) : null}
      <TermsFields
        terms={terms}
        onChange={setTerms}
        errors={errors}
        today={today}
        autoStart={autoStart}
        isNew={false}
      />
      <OccupantsFields terms={terms} onChange={setTerms} errors={errors} />
      {canEditTenant ? (
        <div className="flex flex-col gap-4 border-t border-separator pt-4">
          <span className="text-base font-semibold">The tenant</span>
          <TenantFields tenant={tenant} onChange={setTenant} errors={tenantErrors} />
        </div>
      ) : (
        <p className="text-xs text-muted">
          The tenant&apos;s details can&apos;t change here: a contract they signed names them as they were.
        </p>
      )}
    </SidePanel>
  );
}
