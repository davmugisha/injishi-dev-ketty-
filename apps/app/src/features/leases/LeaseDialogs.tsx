"use client";

import { Alert, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import { type IdKind, type LeaseChargeView, type LeaseDetail, RWANDA_CODE } from "@injishi/contracts";
import { EmailInput, FormDialog, formatDay, formatMoney, Icon, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { cancelLease, editLease, resendInvitation, sendRentReminder } from "./actions";
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
  const [typo, setTypo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changing = email.trim().toLowerCase() !== current.trim().toLowerCase();
  const submit = () =>
    start(async () => {
      // A likely slip is settled first, with the check's own buttons under the field.
      if (changing && typo && !keep) return;
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
          setErrors({});
          setFormError(null);
        }}
        onTypoChange={(t) => {
          setKeep(t.kept);
          setTypo(t.suggestion !== null);
        }}
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
      submitIcon="Xmark"
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

/** Remind the tenant, by email, of everything still open on the lease, with a line of the landlord's own. */
export function ReminderDialog({
  lease,
  open,
  onClose,
}: {
  lease: LeaseDetail;
  /** The charges still owed (rent and deposit). */
  open: LeaseChargeView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = open.reduce((s, c) => s + c.outstandingRwf, 0);
  const submit = () =>
    start(async () => {
      const result = await sendRentReminder({
        chargeIds: open.map((c) => c.id),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      const { sent, skipped } = result.value;
      if (sent.length === 0) {
        setFormError(skipped[0]?.reason ?? "Nothing was sent.");
        return;
      }
      toast.success(`Reminder sent to ${sent[0]?.emailedTo ?? lease.tenant.fullName}`);
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Send a reminder"
      description={`${lease.tenant.fullName} gets an email with what is owed and a link to pay.`}
      submitLabel="Send reminder"
      submitIcon="Bell"
      isPending={pending}
      formError={formError}
      footerHint="One reminder per charge a day."
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ul className="flex flex-col gap-1 text-sm">
        {open.map((c) => (
          <li key={c.id} className="flex justify-between gap-6">
            <span>
              {c.label}
              <span className="text-muted"> · due {formatDay(c.dueOn)}</span>
            </span>
            <span className="tabular">{formatMoney(c.outstandingRwf)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-6 border-t border-separator pt-1 font-semibold">
          <span>Owed</span>
          <span className="tabular">{formatMoney(total)}</span>
        </li>
      </ul>
      <TextInput
        label="A line of your own"
        name="note"
        value={note}
        onChange={setNote}
        multiline
        description="Optional. Added under the reminder."
      />
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
