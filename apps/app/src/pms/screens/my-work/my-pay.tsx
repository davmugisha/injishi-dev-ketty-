"use client";

/**
 * My work · My pay (ADR-058, 058-payroll AC-PY9; 058-self-service AC-SS7).
 *
 * A person's own payslips, each a PDF the server draws, and what they still
 * owe on a loan or an advance. Only CONFIRMED months are listed: a draft is
 * the office's working copy and can still change, and a figure somebody has
 * seen is a figure they will hold the office to.
 *
 * No wage is shown outside a payslip, and no colleague's anything: every route
 * this page calls answers for the caller's own file or with a 404.
 */

import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading } from "../../components/ui";
import { downloadMyPayslip, useMyLoans, useMyPayslips } from "../../data/my-work";
import { dshortIso, fmt } from "../../lib/format";
import { usePms } from "../../store";
import { RowList, rowClass } from "../staff/staff-ui";
import { Loading, monthText } from "./my-work-ui";

export function MyPay({ employeeId }: { employeeId: string }) {
  const { toastError } = usePms();
  const payslips = useMyPayslips(employeeId);
  const loans = useMyLoans(employeeId);
  const [saving, setSaving] = useState<string | null>(null);

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
