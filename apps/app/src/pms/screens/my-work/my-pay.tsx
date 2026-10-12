"use client";

/**
 * My work · My pay (ADR-058, 058-payroll AC-PY9; 058-self-service AC-SS7).
 *
 * A person's own payslips, each a PDF the server draws, what they still owe
 * on a loan or an advance, and the money they have asked back. Only CONFIRMED
 * months are listed: a draft is the office's working copy and can still
 * change, and a figure somebody has seen is a figure they will hold the office
 * to.
 *
 * MONEY BACK IS ASKED HERE. Somebody who paid for a taxi or a part out of
 * their own pocket used to tell the office, who typed the claim for them
 * under Payroll. They type it themselves now: how much, what for, and the
 * receipt if they have one. The office decides it, and an approved claim is
 * paid with the month's pay.
 *
 * No wage is shown outside a payslip, and no colleague's anything: every route
 * this page calls answers for the caller's own file or with a 404.
 */

import type { PayClaim } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading } from "../../components/ui";
import { downloadMyPayslip, uploadMyNote, useAskClaim, useCancelMyClaim, useMyClaims, useMyLoans, useMyPayslips } from "../../data/my-work";
import { dshortIso, fmt, kigaliDateOf } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, daysText, inputClass, rowClass } from "../staff/staff-ui";
import { Loading, Panel, monthText } from "./my-work-ui";

const CLAIM_INTENT: Record<PayClaim["status"], "info" | "ok" | "bad" | "neutral"> = {
  requested: "info",
  approved: "ok",
  rejected: "bad",
  cancelled: "neutral",
};
const CLAIM_LABEL: Record<PayClaim["status"], string> = {
  requested: "Waiting",
  approved: "Approved",
  rejected: "Refused",
  cancelled: "Cancelled",
};

/** Ask for money back: how much, what for, and the receipt when there is one. */
function ClaimForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const { toast } = usePms();
  const ask = useAskClaim(employeeId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const amountRwf = Number(amount.replace(/[^\d]/g, ""));
  const missing = amountRwf <= 0 ? "Say how much first." : reason.trim().length < 3 ? "Say what it was for." : undefined;

  async function send() {
    if (missing || ask.isPending || uploading) return;
    setUploadError(null);
    let receiptKey: string | null = null;
    if (receipt) {
      setUploading(true);
      try {
        receiptKey = (await uploadMyNote(employeeId, receipt)).key;
      } catch (error) {
        setUploadError(error);
        return;
      } finally {
        setUploading(false);
      }
    }
    ask.mutate(
      { kind: "reimbursement", amountRwf, reason: reason.trim(), receiptKey },
      {
        onSuccess: () => {
          toast(`Sent: ${fmt(amountRwf)} to be paid back. You will see the answer here.`, "ok");
          onDone();
        },
      },
    );
  }

  return (
    <Panel className="flex flex-col gap-3.5 px-5 py-4">
      <SectionHeading>Ask for money back</SectionHeading>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
        <Field label="How much (RWF)" htmlFor="claim-amount">
          <Input id="claim-amount" inputMode="numeric" placeholder="12,000" value={amount} onChange={(ev) => setAmount(ev.target.value)} className={`${inputClass} pms-num`} />
        </Field>
        <div className="@xl:col-span-2">
          <Field label="What it was for" htmlFor="claim-reason">
            <Input id="claim-reason" maxLength={300} placeholder="Taxi to the supplier, 9 October" value={reason} onChange={(ev) => setReason(ev.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>
      <Field label="The receipt" htmlFor="claim-receipt" hint="Optional. A photo or a PDF, 10 MB at most. A claim with its receipt is decided sooner.">
        <input
          id="claim-receipt"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(ev) => setReceipt(ev.target.files?.[0] ?? null)}
          className="text-sm text-ink2"
        />
      </Field>
      <FormError error={uploadError ?? ask.error} />
      <div className="flex gap-2.5">
        <ActionButton variant="primary" pending={ask.isPending || uploading} deniedReason={missing} onClick={() => void send()}>
          {uploading ? "Sending the receipt" : "Send the claim"}
        </ActionButton>
        <ActionButton onClick={onDone}>Cancel</ActionButton>
      </div>
    </Panel>
  );
}

export function MyPay({ employeeId }: { employeeId: string }) {
  const { toastError } = usePms();
  const payslips = useMyPayslips(employeeId);
  const loans = useMyLoans(employeeId);
  const claims = useMyClaims(employeeId);
  const cancelClaim = useCancelMyClaim(employeeId);
  const [saving, setSaving] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const asked = [...(claims.data?.claims ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const slips = [...(payslips.data?.payslips ?? [])].sort((a, b) => b.period.localeCompare(a.period));
  const owed = (loans.data?.loans ?? []).filter((l) => l.settledAt === null);

  async function save(id: string, period: string) {
    if (saving) return;
    setSaving(id);
    try {
      await downloadMyPayslip(employeeId, id, period);
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Your payslips, and money you paid for work out of your own pocket.
        </p>
        {!claiming && (
          <ActionButton variant="primary" onClick={() => setClaiming(true)}>
            Ask for money back
          </ActionButton>
        )}
      </div>

      {claiming && <ClaimForm employeeId={employeeId} onDone={() => setClaiming(false)} />}

      {asked.length > 0 && (
        <div className="flex flex-col gap-0">
          <SectionHeading n={asked.length}>Money you asked back</SectionHeading>
          <RowList>
            {asked.map((c, index) => (
              <div key={c.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`} data-my-claim={c.id}>
                <span className="flex min-w-44 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    {c.kind === "reimbursement" ? fmt(c.amountRwf ?? 0) : `${daysText(c.days ?? 0)} of ${c.leaveType?.name.toLowerCase() ?? "leave"} paid out`}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {c.reason} · asked {dshortIso(kigaliDateOf(c.createdAt))}
                    {c.status === "approved" ? ` · ${c.paid ? "paid" : "to be paid"} with ${monthText(c.period)}'s pay` : ""}
                  </span>
                  {c.decisionNote && <span className="text-2xs text-ink2">“{c.decisionNote}”</span>}
                </span>
                <Badge intent={CLAIM_INTENT[c.status]}>{CLAIM_LABEL[c.status]}</Badge>
                {c.status === "requested" && (
                  <ActionButton
                    pending={cancelClaim.isPending && cancelClaim.variables?.id === c.id}
                    onClick={() => cancelClaim.mutate({ id: c.id }, { onError: toastError })}
                  >
                    Cancel
                  </ActionButton>
                )}
              </div>
            ))}
          </RowList>
        </div>
      )}

      <div className="flex flex-col gap-0">
        <SectionHeading n={slips.length}>Your payslips</SectionHeading>
        {payslips.isPending ? (
          <div className="mt-2.5">
            <Loading rows={2} />
          </div>
        ) : payslips.isError ? (
          <LoadFailed className="mt-2.5" onRetry={() => void payslips.refetch()} retrying={payslips.isFetching}>
            We couldn&apos;t load your payslips. Nothing is lost. Try again.
          </LoadFailed>
        ) : slips.length === 0 ? (
          <EmptyState className="mt-2.5">
            No payslip yet. One appears here once the office confirms a month&apos;s pay; a month still being worked on
            is not shown.
          </EmptyState>
        ) : (
          <RowList>
            {slips.map((slip, index) => (
              <div key={slip.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">{monthText(slip.period)}</span>
                  <span className="pms-num text-2xs text-muted-foreground">Gross {fmt(slip.grossRwf)}</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="pms-num text-sm font-bold text-ink">{fmt(slip.netRwf)}</span>
                  <span className="text-2xs text-muted-foreground">net, to you</span>
                </span>
                <Badge intent={slip.paidAt ? "ok" : "warn"}>{slip.paidAt ? `Paid ${dshortIso(slip.paidAt)}` : "Not yet paid"}</Badge>
                <ActionButton pending={saving === slip.id} onClick={() => void save(slip.id, slip.period)}>
                  Download PDF
                </ActionButton>
              </div>
            ))}
          </RowList>
        )}
      </div>

      {owed.length > 0 && (
        <div className="flex flex-col gap-0">
          <SectionHeading n={owed.length}>Loans and advances</SectionHeading>
          <RowList>
            {owed.map((loan, index) => (
              <div key={loan.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {loan.kind === "advance" ? "Advance" : "Loan"} of {fmt(loan.amountRwf)}
                  </span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    Given {dshortIso(loan.givenOn)}, taken from pay over {loan.installments} month{loan.installments === 1 ? "" : "s"} from{" "}
                    {monthText(loan.firstPeriod)}
                    {loan.reason ? ` · ${loan.reason}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="pms-num text-sm font-bold text-ink">{fmt(loan.remainingRwf)}</span>
                  <span className="text-2xs text-muted-foreground">still to repay</span>
                </span>
              </div>
            ))}
          </RowList>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        A figure that looks wrong? Tell the office before the month is paid: a confirmed payslip is put right on the
        next one, never edited.
      </p>
    </div>
  );
}
