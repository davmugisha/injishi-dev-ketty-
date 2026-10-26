"use client";

import { Toast } from "@heroui/react";
import {
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_SOURCE_LABEL,
  type ExpenseList,
  type ExpenseView,
  LOAN_PURPOSE_LABEL,
  TAX_YEAR_MIN,
} from "@injishi/contracts";
import {
  ActionButton,
  CategoryDonut,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  FilterTabs,
  formatNumber,
  IconAction,
  KpiStrip,
  ListToolbar,
  Money,
  MonthlyAmountArea,
  PageContent,
  PageHeader,
  RowActions,
  SearchBar,
  StatusChip,
  YearPicker,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AddExpensePanel, ReceiptDialog, VoidExpenseDialog } from "./ExpenseDialogs";

export type ExpenseShow = "all" | "repairs" | "loan_interest" | "other";

const inShow = (e: ExpenseView, show: ExpenseShow) =>
  show === "all" ||
  (show === "other" ? e.category !== "repairs" && e.category !== "loan_interest" : e.category === show);

/**
 * Expenses (P4): the year's figures (each opens the list it counts), where the money went by category
 * and by month, and every expense with its receipt. Fixers paid for a fault land here by themselves;
 * the rest is written down here. A recorded expense can be voided with a reason.
 */
export function ExpensesView({
  list,
  show,
  today,
  properties,
  units,
  canManage,
}: {
  list: ExpenseList;
  show: ExpenseShow;
  today: string;
  properties: { id: string; name: string }[];
  units: { id: string; label: string; propertyId: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseView | null>(null);
  const [attaching, setAttaching] = useState<ExpenseView | null>(null);

  const href = (next: { year?: number; show?: ExpenseShow }) => {
    const year = next.year ?? list.year;
    const s = next.show ?? show;
    const params = new URLSearchParams();
    if (year !== Number(today.slice(0, 4))) params.set("year", String(year));
    if (s !== "all") params.set("show", s);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const go = (next: { year?: number; show?: ExpenseShow }) =>
    start(() => router.replace(href(next), { scroll: false }));

  const counted = list.items.filter((e) => !e.voided);
  const sum = (s: ExpenseShow) => counted.filter((e) => inShow(e, s)).reduce((t, e) => t + e.amountRwf, 0);
  const count = (s: ExpenseShow) => list.items.filter((e) => inShow(e, s)).length;
  const running = list.year === Number(today.slice(0, 4));
  const lastMonth = running ? Number(today.slice(5, 7)) : 12;
  const months = Array.from({ length: lastMonth }, (_, i) => {
    const month = `${list.year}-${String(i + 1).padStart(2, "0")}`;
    return { month, amount: counted.filter((e) => e.paidOn.startsWith(month)).reduce((t, e) => t + e.amountRwf, 0) };
  });

  const missingReceipts = counted.filter((e) => e.source === "recorded" && !e.hasReceipt);

  const q = search.trim().toLowerCase();
  const rows = list.items.filter(
    (e) =>
      inShow(e, show) &&
      (!q ||
        [e.payeeName, e.note, e.unitLabel, e.ticketTitle, EXPENSE_CATEGORY_LABEL[e.category]]
          .filter(Boolean)
          .some((t) => (t as string).toLowerCase().includes(q))),
  );

  const columns = useMemo<DataColumn<ExpenseView>[]>(
    () => [
      {
        id: "on",
        header: "Paid on",
        sortValue: (e) => e.paidOn,
        cell: (e) => (
          <span className={e.voided ? "text-muted line-through" : undefined}>
            <DateText value={e.paidOn} />
          </span>
        ),
      },
      {
        id: "what",
        header: "For",
        isRowHeader: true,
        sortValue: (e) => e.category,
        cell: (e) => (
          <div className="flex min-w-0 flex-col">
            <span className={e.voided ? "font-medium text-muted line-through" : "font-medium"}>
              {EXPENSE_CATEGORY_LABEL[e.category]}
            </span>
            <span className="truncate text-xs text-muted">
              {e.voided
                ? `Voided: ${e.voided.reason}`
                : (e.ticketTitle ??
                  (e.loanPurpose ? `Loan ${LOAN_PURPOSE_LABEL[e.loanPurpose].toLowerCase()}` : e.note))}
            </span>
          </div>
        ),
      },
      {
        id: "payee",
        header: "Paid to",
        sortValue: (e) => e.payeeName,
        cell: (e) => e.payeeName ?? <span className="text-muted">-</span>,
      },
      {
        id: "unit",
        header: "Unit",
        hideBelow: "lg",
        sortValue: (e) => e.unitLabel,
        cell: (e) => e.unitLabel ?? <span className="text-muted">-</span>,
      },
      {
        id: "amount",
        header: "Amount",
        align: "end",
        sortValue: (e) => e.amountRwf,
        cell: (e) => <Money value={e.amountRwf} className={e.voided ? "text-muted line-through" : "font-medium"} />,
      },
      {
        id: "source",
        header: "Source",
        hideBelow: "lg",
        cell: (e) =>
          e.voided ? (
            <StatusChip tone="default">Voided</StatusChip>
          ) : (
            <StatusChip tone={e.source === "gateway" ? "success" : "info"}>{EXPENSE_SOURCE_LABEL[e.source]}</StatusChip>
          ),
      },
      {
        id: "receipt",
        header: "Receipt",
        hideBelow: "xl",
        cell: (e) =>
          e.receiptUrl ? (
            <a
              href={e.receiptUrl}
              download="receipt"
              target="_blank"
              rel="noopener"
              className="text-sm text-accent hover:underline"
            >
              Open
            </a>
          ) : (
            <span className="text-muted">-</span>
          ),
      },
    ],
    [],
  );

  const addButton = canManage ? (
    <ActionButton icon="Plus" intent="primary" onPress={() => setAdding(true)}>
      Add expense
    </ActionButton>
  ) : null;
  const tabs: { id: ExpenseShow; label: string }[] = [
    { id: "all", label: "All" },
    { id: "repairs", label: "Repairs" },
    { id: "loan_interest", label: "Loan interest" },
    { id: "other", label: "Other" },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        title="Expenses"
        actions={
          <>
            <YearPicker
              label="Year"
              value={list.year}
              onChange={(year) => go({ year })}
              today={today}
              min={TAX_YEAR_MIN}
            />
            {addButton}
          </>
        }
      />

      <KpiStrip
        label={`Expenses in ${list.year}`}
        items={[
          {
            id: "all",
            label: running ? "Spent so far" : "Spent",
            value: list.totals.totalRwf,
            icon: "Receipt",
            footnote: `${formatNumber(counted.length)} ${counted.length === 1 ? "payment" : "payments"} in ${list.year}`,
          },
          {
            id: "month",
            label: running ? "This month" : "December",
            value: months.at(-1)?.amount ?? 0,
            icon: "Calendar",
          },
          {
            id: "average",
            label: "Monthly average",
            value: months.length > 0 ? Math.round(list.totals.totalRwf / months.length) : 0,
            icon: "ChartLine",
          },
          {
            id: "receipts",
            label: "Receipts missing",
            value: missingReceipts.length,
            format: "count",
            icon: "Paperclip",
            status: missingReceipts.length > 0 ? "warning" : undefined,
            footnote: missingReceipts.length > 0 ? "Attach them from the list" : "All on file",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlyAmountArea
          title="By month"
          seriesLabel="Spent"
          narrowMonths={12}
          data={months}
          empty={{ icon: "Receipt", title: `Nothing spent in ${list.year} yet`, action: addButton ?? undefined }}
        />
        <CategoryDonut
          title="By category"
          data={list.totals.byCategory.map((c) => ({
            category: EXPENSE_CATEGORY_LABEL[c.category],
            amount: c.amountRwf,
          }))}
          emptyAction={addButton ?? undefined}
        />
      </div>

      <ListToolbar
        tabs={
          <FilterTabs
            label="Expenses by kind"
            tabs={tabs.map((t) => ({ ...t, count: count(t.id) }))}
            selectedKey={show}
            onSelectionChange={(key) => go({ show: key as ExpenseShow })}
          />
        }
      >
        <SearchBar label="Search expenses" value={search} onChange={setSearch} placeholder="Payee, unit or note" />
      </ListToolbar>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Expenses"
          rows={rows}
          rowKey={(e) => e.id}
          columns={columns}
          defaultSort={{ column: "on", direction: "descending" }}
          rowActions={
            canManage
              ? (e) =>
                  e.voided || (!e.canVoid && (e.hasReceipt || e.source === "gateway")) ? null : (
                    <RowActions>
                      {!e.hasReceipt && e.source === "recorded" ? (
                        <IconAction icon="Paperclip" label="Attach the receipt" onPress={() => setAttaching(e)} />
                      ) : null}
                      {e.canVoid ? (
                        <IconAction icon="TrashBin" intent="danger" label="Void" onPress={() => setVoiding(e)} />
                      ) : null}
                    </RowActions>
                  )
              : undefined
          }
          mobile={{
            title: (e) => EXPENSE_CATEGORY_LABEL[e.category],
            description: (e) =>
              [
                e.payeeName,
                e.unitLabel ? `Unit ${e.unitLabel}` : null,
                e.voided ? "Voided" : EXPENSE_SOURCE_LABEL[e.source],
              ]
                .filter(Boolean)
                .join(" · "),
            trailing: (e) => (
              <span className="flex flex-col items-end">
                <Money value={e.amountRwf} className={e.voided ? "text-muted line-through" : "font-medium"} />
                <span className="text-xs text-muted">
                  <DateText value={e.paidOn} />
                </span>
              </span>
            ),
          }}
          empty={
            show !== "all" || q ? (
              <EmptyBlock
                icon="Magnifier"
                title="No expense matches"
                action={
                  <ActionButton
                    icon="Xmark"
                    onPress={() => {
                      setSearch("");
                      go({ show: "all" });
                    }}
                  >
                    Clear filters
                  </ActionButton>
                }
              />
            ) : (
              <EmptyBlock
                icon="Receipt"
                title={`No expenses in ${list.year}`}
                description="Fixers you pay for a fault show here. Add the rest: the guard, water, loan interest."
                action={addButton ?? undefined}
              />
            )
          }
        />
      </div>

      {adding ? <AddExpensePanel properties={properties} units={units} onClose={() => setAdding(false)} /> : null}
      {voiding ? <VoidExpenseDialog expense={voiding} onClose={() => setVoiding(null)} /> : null}
      {attaching ? <ReceiptDialog expense={attaching} onClose={() => setAttaching(null)} /> : null}
    </PageContent>
  );
}
