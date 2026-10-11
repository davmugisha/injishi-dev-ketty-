"use client";

/**
 * Payroll · Loans and advances (058-payroll AC-PY8).
 *
 * A loan or a salary advance is recorded once, with its whole schedule: equal
 * installments rounded down to the franc, the last taking the remainder, so
 * they add up to the amount. Paid out on a payslip, it reaches the person with
 * the net of the month it was given; paid outside Injishi, only the
 * repayments show. Each run takes the month's installment. Deferring moves an
 * installment and every later one a month on; settling early takes all that is
 * owed in one month. Neither ever reaches into a month whose pay is confirmed.
 */

import { LOAN_LIST, type Loan, type LoanKind } from "@injishi/contracts";
import { DataView, Input, Progress, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreateLoan, useLoanCommand, useLoanPage } from "../../data/payroll";
import { useEmployees } from "../../data/people";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { monthName, nextPeriodOf } from "./payroll-ui";
import { Field, FormError, inputClass } from "./staff-ui";

const KIND: Record<LoanKind, string> = { loan: "Loan", advance: "Advance" };

export function PayLoans() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, LOAN_LIST.key);
  const list = useListUrl(LOAN_LIST, "full", defaultView);
  const page = useLoanPage(workspaceId, list.state.query);
  const shown = (page.data?.items ?? []).find((l) => l.id === open) ?? null;

  const columns: DataColumn<Loan>[] = [
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className="flex flex-col gap-0.5" data-loan={r.id}>
          <span className="font-semibold text-foreground">{r.employee.displayName}</span>
          {r.reason && <span className="text-2xs text-muted-foreground">{r.reason}</span>}
        </span>
      ),
    },
    { key: "kind", header: "Kind", cell: (r) => KIND[r.kind] },
    { key: "amountRwf", header: "Amount", align: "end", cell: (r) => fmt(r.amountRwf) },
    { key: "givenOn", header: "Given", cell: (r) => dshortIso(r.givenOn) },
    {
      key: "repaid",
      header: "Repaid",
      cell: (r) => (
        <span className="flex min-w-32 flex-col gap-1">
          <Progress value={r.amountRwf > 0 ? (r.paidRwf / r.amountRwf) * 100 : 0} aria-label={`${r.employee.displayName}: ${fmt(r.paidRwf)} of ${fmt(r.amountRwf)} repaid`} />
          <span className="pms-num text-2xs text-muted-foreground">
            {fmt(r.paidRwf)} paid, {fmt(r.remainingRwf)} left
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge intent={r.settledAt ? "ok" : "warn"}>{r.settledAt ? "Repaid" : "Open"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (
        <ActionButton onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Schedule"}</ActionButton>
      ),
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          A loan is repaid in installments from pay. An advance is a loan repaid quickly, usually in one month.
        </span>
        {!adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Record a loan
          </ActionButton>
        )}
      </div>
      {adding && <LoanForm onDone={() => setAdding(false)} />}
      {shown && <Schedule loan={shown} onClose={() => setOpen(null)} />}
      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Loans and advances</SectionHeading>
        <DataView
          spec={LOAN_LIST}
          reader="full"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.id}
          labelOf={(r) => r.employee.displayName}
          groupKeyOf={(r, field) => (field === "kind" ? r.kind : field === "status" ? (r.settledAt ? "settled" : "open") : field === "branch" ? r.branchId : null)}
          caption="Loans and advances"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          savedViews={savedViews}
          empty={{ title: "No loan yet", body: "A loan or an advance recorded here is repaid from pay." }}
        />
      </section>
    </div>
  );
}

/** One loan's installments: defer one, or settle everything owed in one month. */
function Schedule({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const act = useLoanCommand(workspaceId);
  const unpaid = loan.schedule.filter((i) => !i.paid);
  const [settleIn, setSettleIn] = useState(unpaid[0]?.period ?? todayIso().slice(0, 7));

  return (
    <section className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-5" aria-label={`${loan.employee.displayName}'s schedule`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading>
          {KIND[loan.kind]} of {fmt(loan.amountRwf)} to {loan.employee.displayName}
        </SectionHeading>
        <ActionButton onClick={onClose}>Close</ActionButton>
      </div>
      <p className="text-2xs text-muted-foreground">
        Given {dshortIso(loan.givenOn)}, {loan.paidOut === "payslip" ? "paid out with that month's net" : "paid outside Injishi"}, in{" "}
        {loan.installments} installment{loan.installments === 1 ? "" : "s"}.
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">Installments</caption>
        <thead>
          <tr className="text-left text-2xs text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-semibold">Month</th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">Amount</th>
            <th scope="col" className="py-1 pr-3 font-semibold">State</th>
            <th scope="col" className="py-1" />
          </tr>
        </thead>
        <tbody>
          {loan.schedule.map((i) => (
            <tr key={i.id} className="border-t border-line">
              <td className="py-1.5 pr-3">
                {monthName(i.period)}
                {i.deferredFrom && <span className="text-2xs text-muted-foreground"> (moved from {monthName(i.deferredFrom)})</span>}
              </td>
              <td className="pms-num py-1.5 pr-3 text-right">{fmt(i.amountRwf)}</td>
              <td className="py-1.5 pr-3">
                <Badge intent={i.paid ? "ok" : "neutral"}>{i.paid ? "Paid" : "To take"}</Badge>
              </td>
              <td className="py-1.5 text-right">
                {!i.paid && !loan.settledAt && (
                  <ActionButton
                    pending={act.isPending && act.variables?.action === "defer" && act.variables.period === i.period}
                    onClick={() =>
                      act.mutate(
                        { id: loan.id, action: "defer", period: i.period },
                        { onSuccess: () => toast(`${monthName(i.period)}'s installment moved to ${monthName(nextPeriodOf(i.period))}`, "ok") },
                      )
                    }
                  >
                    Defer a month
                  </ActionButton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {unpaid.length > 1 && !loan.settledAt && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-line pt-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            act.mutate(
              { id: loan.id, action: "settle", period: settleIn },
              { onSuccess: () => toast(`Everything owed is taken in ${monthName(settleIn)}`, "ok") },
            );
          }}
        >
          <Field label="Settle early in" hint={`Takes the ${fmt(loan.remainingRwf)} still owed in one month.`} htmlFor="settle-in">
            <Input id="settle-in" type="month" value={settleIn} onChange={(e) => e.target.value && setSettleIn(e.target.value)} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
          </Field>
          <ActionButton type="submit" pending={act.isPending && act.variables?.action === "settle"}>
            Settle early
          </ActionButton>
        </form>
      )}
      <FormError error={act.error} />
    </section>
  );
}

function LoanForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const create = useCreateLoan(workspaceId);
  const [draft, setDraft] = useState({
    employeeId: "",
    kind: "loan" as LoanKind,
    amountRwf: "",
    givenOn: todayIso(),
    installments: "3",
    firstPeriod: todayIso().slice(0, 7),
    paidOut: "payslip" as "payslip" | "outside",
    reason: "",
  });
  const amount = Number(draft.amountRwf);
  const count = Number(draft.installments);
  const each = amount > 0 && count > 0 ? Math.floor(amount / count) : 0;
  const last = amount - each * (count - 1);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId) return;
        create.mutate(
          {
            employeeId: draft.employeeId,
            kind: draft.kind,
            amountRwf: amount,
            givenOn: draft.givenOn,
            installments: count,
            firstPeriod: draft.firstPeriod,
            paidOut: draft.paidOut,
            reason: draft.reason.trim() || null,
          },
          {
            onSuccess: (loan) => {
              toast(`${KIND[loan.kind]} of ${fmt(loan.amountRwf)} recorded for ${loan.employee.displayName}`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Record a loan or an advance</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v })}
            placeholder="Choose someone"
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        <Field label="Kind">
          <SelectField
            label="Kind"
            value={draft.kind}
            onChange={(v) => setDraft({ ...draft, kind: v === "advance" ? "advance" : "loan", installments: v === "advance" ? "1" : draft.installments })}
            options={[
              { value: "loan", label: "Loan" },
              { value: "advance", label: "Salary advance" },
            ]}
          />
        </Field>
        <Field label="Amount in RWF" htmlFor="loan-amount">
          <Input id="loan-amount" type="number" min={1} step={1} required value={draft.amountRwf} onChange={(e) => setDraft({ ...draft, amountRwf: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Given on" htmlFor="loan-given">
          <Input id="loan-given" type="date" required value={draft.givenOn} onChange={(e) => e.target.value && setDraft({ ...draft, givenOn: e.target.value })} className={inputClass} />
        </Field>
        <Field
          label="Installments"
          hint={each > 0 ? (count > 1 && last !== each ? `${count - 1} × ${fmt(each)}, then ${fmt(last)}` : `${count} × ${fmt(each)}`) : "Equal, the last taking the remainder."}
          htmlFor="loan-count"
        >
          <Input id="loan-count" type="number" min={1} max={120} step={1} required value={draft.installments} onChange={(e) => setDraft({ ...draft, installments: e.target.value })} className={inputClass} />
        </Field>
        <Field label="First repayment" htmlFor="loan-first">
          <Input id="loan-first" type="month" required value={draft.firstPeriod} onChange={(e) => e.target.value && setDraft({ ...draft, firstPeriod: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Paid out" hint="On a payslip, it reaches them with that month's net.">
          <SelectField
            label="Paid out"
            value={draft.paidOut}
            onChange={(v) => setDraft({ ...draft, paidOut: v === "outside" ? "outside" : "payslip" })}
            options={[
              { value: "payslip", label: "On the payslip" },
              { value: "outside", label: "Outside Injishi" },
            ]}
          />
        </Field>
        <Field label="What it is for" htmlFor="loan-reason">
          <Input id="loan-reason" maxLength={300} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending}>
          {create.isPending ? "Recording" : "Record"}
        </ActionButton>
      </div>
    </form>
  );
}
