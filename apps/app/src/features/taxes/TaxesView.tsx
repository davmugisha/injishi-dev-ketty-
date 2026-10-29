"use client";

import { Alert, Toast } from "@heroui/react";
import {
  EXPENSE_CATEGORY_LABEL,
  LEASE_FILING_KIND_LABEL,
  type LeaseFilingView,
  LOAN_PURPOSE_LABEL,
  TAX_DECLARATION_STATUS_LABEL,
  TAX_YEAR_MIN,
  type TaxYearView,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  daysBetween,
  EmptyBlock,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  IconAction,
  KpiStrip,
  Money,
  PageContent,
  PageHeader,
  PersonCell,
  RowActions,
  SectionCard,
  StatusChip,
  type StatusTone,
  YearPicker,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { leaseHref } from "../leases/shared";
import { DeclarationPanel, MarkFiledDialog, TaxpayerChoice } from "./TaxDialogs";

export const RRA_RENTAL_TAX_URL = "https://www.rra.gov.rw/en/taxes-fees/local-government-taxes/rental-income-tax";

const DECLARATION_TONE: Record<TaxYearView["declaration"]["status"], StatusTone> = {
  not_started: "warning",
  declared: "info",
  paid: "success",
};

const bandWords = (from: number, to: number | null) =>
  to === null ? `Above ${formatNumber(from)}` : `${formatNumber(from)} to ${formatNumber(to)}`;

/** One step of the calculation: what, an optional note, and the amount (signed when it takes away). */
function Step({
  label,
  note,
  amount,
  minus,
  strong,
}: {
  label: ReactNode;
  note?: ReactNode;
  amount: number;
  minus?: boolean;
  strong?: boolean;
}) {
  return (
    <li className={strong ? "flex items-start gap-4 py-2.5 font-semibold" : "flex items-start gap-4 py-2.5"}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {note ? <span className="text-xs font-normal text-muted">{note}</span> : null}
      </div>
      <span className="text-sm tabular">
        {minus && amount > 0 ? "- " : ""}
        <Money value={amount} />
      </span>
    </li>
  );
}

/**
 * Taxes (P4): the year's rental income tax as RRA works it out (rent received, less 50%, less the bank
 * interest on a loan to build or buy, then the bands), or a company's profit; the deadline with a
 * countdown and what paying late adds; where the declaration stands; and the lease copies owed to RRA.
 */
export function TaxesView({
  view,
  filings,
  today,
  canManage,
}: {
  view: TaxYearView;
  filings: LeaseFilingView[];
  today: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [declaring, setDeclaring] = useState(false);
  const [changingKind, setChangingKind] = useState(false);
  const [filing, setFiling] = useState<LeaseFilingView | null>(null);
  const thisYear = Number(today.slice(0, 4));
  const go = (year: number) =>
    start(() => router.replace(year === thisYear ? pathname : `${pathname}?year=${year}`, { scroll: false }));

  const soFar = view.running ? " so far" : "";
  const daysLeft = daysBetween(today, view.dueOn);
  const declared = view.declaration.status !== "not_started";
  const due = filings.filter((f) => f.status === "pending");

  const header = (
    <PageHeader
      title="Taxes"
      actions={
        <>
          <YearPicker label="Year" value={view.year} onChange={go} today={today} min={TAX_YEAR_MIN} />
          <ActionLink
            href={RRA_RENTAL_TAX_URL}
            target="_blank"
            rel="noopener"
            icon="ArrowUpRightFromSquare"
            intent="ghost"
          >
            RRA rental income tax
          </ActionLink>
        </>
      }
    />
  );

  const filingColumns: DataColumn<LeaseFilingView>[] = [
    {
      id: "lease",
      header: "Lease",
      isRowHeader: true,
      sortValue: (f) => f.leaseReference,
      cell: (f) => <PersonCell name={f.tenantName} secondary={`${f.leaseReference} · Unit ${f.unitLabel}`} />,
    },
    { id: "kind", header: "What", hideBelow: "lg", cell: (f) => LEASE_FILING_KIND_LABEL[f.kind] },
    {
      id: "due",
      header: "Due",
      sortValue: (f) => f.dueOn,
      cell: (f) => (
        <span className="flex flex-col">
          <DateText value={f.dueOn} />
          {f.status === "pending" && f.daysLeft !== null ? (
            <span className={f.late ? "text-xs text-danger" : "text-xs text-muted"}>
              {f.late ? `${Math.abs(f.daysLeft)} days late` : f.daysLeft === 0 ? "Today" : `${f.daysLeft} days left`}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (f) => <StatusChip kind="filing" status={f.status === "pending" && f.late ? "overdue" : f.status} />,
    },
    {
      id: "filed",
      header: "Filed",
      hideBelow: "lg",
      cell: (f) =>
        f.filedOn ? (
          <span className="flex flex-col">
            <DateText value={f.filedOn} />
            {f.reference ? <span className="text-xs text-muted">{f.reference}</span> : null}
            {f.proofUrl ? (
              <a
                href={f.proofUrl}
                download={`${f.leaseReference}-rra-proof`}
                target="_blank"
                rel="noopener"
                className="text-xs text-accent hover:underline"
              >
                Proof
              </a>
            ) : null}
          </span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
  ];

  const filingsCard = (
    <SectionCard
      title="Lease copies for RRA"
      description={due.length > 0 ? `${due.length} to file, each within 15 days of signing` : undefined}
      contentClassName="gap-0"
    >
      <DataTable
        label="Lease copies for RRA"
        rows={filings}
        rowKey={(f) => f.id}
        columns={filingColumns}
        onRowAction={(f) => router.push(leaseHref(f.leaseId))}
        rowActions={(f) =>
          f.status !== "pending" || !canManage ? null : (
            <RowActions>
              {f.status === "pending" && canManage ? (
                <IconAction icon="FileCheck" label={`Mark ${f.leaseReference} filed`} onPress={() => setFiling(f)} />
              ) : null}
            </RowActions>
          )
        }
        mobile={{
          title: (f) => `${f.leaseReference} · ${f.tenantName}`,
          description: (f) =>
            f.status === "filed" && f.filedOn ? `Filed ${formatDay(f.filedOn)}` : `Due ${formatDay(f.dueOn)}`,
          trailing: (f) => (
            <StatusChip kind="filing" status={f.status === "pending" && f.late ? "overdue" : f.status} />
          ),
        }}
        empty={<EmptyBlock icon="FileText" title="No lease copies owed" size="sm" />}
      />
    </SectionCard>
  );

  if (view.taxpayer === null) {
    return (
      <PageContent>
        <Toast.Provider placement="bottom" />
        {header}
        <SectionCard
          title="Do you let as a person or a company?"
          description="The tax is worked out differently for each."
        >
          {canManage ? (
            <TaxpayerChoice value={null} />
          ) : (
            <p className="text-sm text-muted">Ask the owner to choose in Taxes.</p>
          )}
        </SectionCard>
        {filingsCard}
      </PageContent>
    );
  }

  const t = view.rentalTax;
  const p = view.profit;
  // Nothing was received and nothing is owed: a past deadline is no alarm.
  const nothing = (t?.grossRentRwf ?? p?.rentRwf ?? 0) === 0 && (t?.taxRwf ?? 0) === 0;
  const late = nothing ? null : view.lateCharges;

  const deadline = (
    <SectionCard title="Deadline" headingLevel={3}>
      <div className="flex items-center gap-3">
        <span
          className={
            late || (daysLeft < 0 && !declared && !nothing)
              ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
              : "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          }
        >
          <Icon
            name={late || (daysLeft < 0 && !declared && !nothing) ? "TriangleExclamation" : "Calendar"}
            className="size-5"
          />
        </span>
        <div className="flex flex-col">
          <span className="font-semibold">{formatDay(view.dueOn, "long")}</span>
          <span className="text-sm text-muted">
            {declared
              ? `Declared ${view.declaration.declaredOn ? formatDay(view.declaration.declaredOn) : ""}`.trim()
              : nothing && !view.running
                ? `No rent was received in ${view.year}`
                : daysLeft > 0
                  ? `${formatNumber(daysLeft)} days left to declare and pay`
                  : daysLeft === 0
                    ? "Due today"
                    : `${formatNumber(-daysLeft)} days late`}
          </span>
        </div>
      </div>
      {late ? (
        <ul className="flex flex-col divide-y divide-separator text-sm">
          <li className="flex justify-between py-1.5">
            <span>Late filing penalty</span>
            <Money value={late.penaltyRwf} />
          </li>
          <li className="flex justify-between py-1.5">
            <span>Late payment surcharge</span>
            <Money value={late.surchargeRwf} />
          </li>
          <li className="flex justify-between py-1.5">
            <span>
              Interest, {late.monthsLate} {late.monthsLate === 1 ? "month" : "months"}
            </span>
            <Money value={late.interestRwf} />
          </li>
          <li className="flex justify-between py-1.5 font-semibold">
            <span>Late charges, estimated</span>
            <Money value={late.totalRwf} />
          </li>
        </ul>
      ) : null}
    </SectionCard>
  );

  const declaration =
    view.taxpayer === "individual" ? (
      <SectionCard
        title="Declaration"
        headingLevel={3}
        actions={
          <StatusChip tone={DECLARATION_TONE[view.declaration.status]}>
            {TAX_DECLARATION_STATUS_LABEL[view.declaration.status]}
          </StatusChip>
        }
      >
        {declared ? (
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
            {view.declaration.declaredOn ? (
              <>
                <dt className="text-muted">Declared</dt>
                <dd>{formatDay(view.declaration.declaredOn, "long")}</dd>
              </>
            ) : null}
            {view.declaration.paidOn ? (
              <>
                <dt className="text-muted">Paid</dt>
                <dd>
                  {formatDay(view.declaration.paidOn, "long")}
                  {view.declaration.amountPaidRwf !== null ? `, ${formatMoney(view.declaration.amountPaidRwf)}` : ""}
                </dd>
              </>
            ) : null}
            {view.declaration.rraReference ? (
              <>
                <dt className="text-muted">RRA reference</dt>
                <dd>{view.declaration.rraReference}</dd>
              </>
            ) : null}
            {view.declaration.receiptUrl ? (
              <>
                <dt className="text-muted">Receipt</dt>
                <dd>
                  <a
                    href={view.declaration.receiptUrl}
                    download="rra-receipt"
                    target="_blank"
                    rel="noopener"
                    className="text-accent hover:underline"
                  >
                    Open
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">
            {view.canDeclare
              ? "Declare and pay on RRA's portal, then mark it here."
              : `You declare from 1 January ${view.year + 1}.`}
          </p>
        )}
        {canManage ? (
          <ActionButton
            icon="PencilToSquare"
            size="sm"
            className="self-start"
            isDisabled={!view.canDeclare}
            onPress={() => setDeclaring(true)}
          >
            {declared ? "Update" : "Mark declared or paid"}
          </ActionButton>
        ) : null}
      </SectionCard>
    ) : null;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      {header}

      <div
        className={
          pending ? "flex flex-col gap-5 opacity-60 transition-opacity" : "flex flex-col gap-5 transition-opacity"
        }
      >
        <KpiStrip
          label={`Tax for ${view.year}`}
          items={
            t
              ? [
                  {
                    id: "rent",
                    label: view.running ? "Rent so far" : "Rent received",
                    value: t.grossRentRwf,
                    icon: "Wallet",
                  },
                  { id: "taxable", label: "Taxable", value: t.taxableIncomeRwf, icon: "Calculator" },
                  {
                    id: "tax",
                    label: view.running ? "Tax so far" : "Tax",
                    value: t.taxRwf,
                    icon: "Receipt",
                    status: late ? "danger" : undefined,
                  },
                  {
                    id: "due",
                    label: daysLeft < 0 ? "Days late" : "Days left",
                    value: Math.abs(daysLeft),
                    format: "count",
                    icon: "Calendar",
                    status:
                      declared || nothing
                        ? undefined
                        : daysLeft < 0
                          ? "danger"
                          : daysLeft <= 30
                            ? "warning"
                            : undefined,
                    footnote: formatDay(view.dueOn, "long"),
                  },
                ]
              : p
                ? [
                    {
                      id: "rent",
                      label: view.running ? "Rent so far" : "Rent received",
                      value: p.rentRwf,
                      icon: "Wallet",
                    },
                    {
                      id: "costs",
                      label: "Costs",
                      value: p.expensesRwf,
                      icon: "Receipt",
                      href: `/expenses?year=${view.year}`,
                    },
                    { id: "profit", label: "Profit", value: p.profitRwf, icon: "ChartLineArrowUp" },
                    { id: "cit", label: "28% of profit", value: p.corporateTaxRwf, icon: "Calculator" },
                  ]
                : []
          }
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
            {t ? (
              <SectionCard
                title={view.running ? `How the tax works out so far` : "How the tax works out"}
                actions={
                  canManage ? (
                    <ActionButton icon="Person" size="sm" intent="ghost" onPress={() => setChangingKind(true)}>
                      As a person
                    </ActionButton>
                  ) : undefined
                }
              >
                <ol className="flex flex-col divide-y divide-separator">
                  <Step
                    label={`Rent received${soFar}`}
                    note={
                      view.rent.depositsExcludedRwf > 0
                        ? `Deposits are not rent: ${formatMoney(view.rent.depositsExcludedRwf)} received for deposits is left out.`
                        : undefined
                    }
                    amount={t.grossRentRwf}
                  />
                  <Step
                    label="Less 50% for upkeep"
                    note="RRA's flat deduction covers repairs and running costs."
                    amount={t.flatDeductionRwf}
                    minus
                  />
                  <Step
                    label="Less bank loan interest"
                    note={
                      t.loanInterestRwf > t.interestDeductedRwf
                        ? `${formatMoney(t.loanInterestRwf)} paid. Only what the rent left can come off.`
                        : "On a loan to build or buy the property."
                    }
                    amount={t.interestDeductedRwf}
                    minus
                  />
                  <Step label="Taxable income" amount={t.taxableIncomeRwf} strong />
                  {t.bands.map((b) => (
                    <Step
                      key={b.fromRwf}
                      label={`${bandWords(b.fromRwf, b.toRwf)} at ${b.ratePercent}%`}
                      note={b.incomeRwf > 0 ? `${formatMoney(b.incomeRwf)} in this band` : undefined}
                      amount={b.taxRwf}
                    />
                  ))}
                  <Step label={view.running ? "Tax so far" : "Tax to pay"} amount={t.taxRwf} strong />
                </ol>
                {view.interest.entries.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Loan interest</span>
                    <ul className="flex flex-col divide-y divide-separator rounded-xl border border-separator">
                      {view.interest.entries.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm">{e.lender ?? "Bank"}</span>
                            <span className="text-xs text-muted">
                              {formatDay(e.paidOn)}
                              {e.loanPurpose ? ` · Loan ${LOAN_PURPOSE_LABEL[e.loanPurpose].toLowerCase()}` : ""}
                            </span>
                          </span>
                          {e.needsBankProof ? <StatusChip tone="warning">Needs bank proof</StatusChip> : null}
                          <Money value={e.amountRwf} className="text-sm" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </SectionCard>
            ) : p ? (
              <SectionCard
                title={view.running ? "Profit so far" : "Profit"}
                actions={
                  canManage ? (
                    <ActionButton icon="Briefcase" size="sm" intent="ghost" onPress={() => setChangingKind(true)}>
                      As a company
                    </ActionButton>
                  ) : undefined
                }
              >
                <ol className="flex flex-col divide-y divide-separator">
                  <Step label={`Rent received${soFar}`} amount={p.rentRwf} />
                  <Step
                    label="Less every cost"
                    note="Repairs, loan interest and the rest from Expenses."
                    amount={p.expensesRwf}
                    minus
                  />
                  <Step label="Profit" amount={p.profitRwf} strong />
                  <Step label="28% corporate income tax" amount={p.corporateTaxRwf} strong />
                </ol>
                <Alert status="accent">
                  <Alert.Indicator>
                    <Icon name="CircleInfo" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>
                      A company pays 28% corporate income tax on its profit with its annual return, not rental income
                      tax.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              </SectionCard>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5 *:last:flex-1">
            {declaration}
            {/* The days left and the date are in the figures; the card adds the late charges, once late. */}
            {view.taxpayer === "individual" && late ? deadline : null}
            {t && view.otherExpenses.totalRwf > 0 ? (
              <SectionCard
                title="Other costs"
                description="Covered by the 50% deduction"
                actions={
                  <ActionLink href={`/expenses?year=${view.year}`} icon="ArrowRight" size="sm" intent="ghost">
                    Expenses
                  </ActionLink>
                }
              >
                <ul className="flex flex-col divide-y divide-separator text-sm">
                  {view.otherExpenses.byCategory.map((c) => (
                    <li key={c.category} className="flex justify-between py-1.5">
                      <span>{EXPENSE_CATEGORY_LABEL[c.category]}</span>
                      <Money value={c.amountRwf} />
                    </li>
                  ))}
                  <li className="flex justify-between py-1.5 font-semibold">
                    <span>Total</span>
                    <Money value={view.otherExpenses.totalRwf} />
                  </li>
                </ul>
              </SectionCard>
            ) : null}
          </div>
        </div>

        {filingsCard}
      </div>

      {declaring ? <DeclarationPanel view={view} onClose={() => setDeclaring(false)} /> : null}
      {changingKind ? <TaxpayerChoice value={view.taxpayer} inDialog onDone={() => setChangingKind(false)} /> : null}
      {filing ? <MarkFiledDialog filing={filing} onClose={() => setFiling(null)} /> : null}
    </PageContent>
  );
}
