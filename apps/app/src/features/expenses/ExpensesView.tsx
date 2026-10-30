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
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  IconAction,
  Money,
  PageContent,
  RowActions,
  StatusChip,
  YearPicker,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { AddExpensePanel, ReceiptDialog, VoidExpenseDialog } from "./ExpenseDialogs";

export type ExpenseShow = "all" | "repairs" | "loan_interest" | "other";

const inShow = (e: ExpenseView, show: ExpenseShow) =>
  show === "all" ||
  (show === "other" ? e.category !== "repairs" && e.category !== "loan_interest" : e.category === show);

/**
 * Expenses (P4): every expense of the year with its receipt, in one table with a search and a kind
 * filter. Fixers paid for a fault land here by themselves;
 * the rest is written down here. A recorded expense can be voided with a reason.
 */
export function ExpensesView({
  list,
  today,
  properties,
  units,
  canManage,
}: {
  list: ExpenseList;
  today: string;
  properties: { id: string; name: string }[];
  units: { id: string; label: string; propertyId: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseView | null>(null);
  const [attaching, setAttaching] = useState<ExpenseView | null>(null);

  const go = ({ year }: { year: number }) =>
    start(() =>
      router.replace(year !== Number(today.slice(0, 4)) ? `${pathname}?year=${year}` : pathname, { scroll: false }),
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
      <AreaHeader
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

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Expenses"
          rows={list.items}
          noun={{ one: "expense", many: "expenses" }}
          search={{
            placeholder: "Payee, unit or note",
            text: (e) =>
              [e.payeeName, e.note, e.unitLabel, e.ticketTitle, EXPENSE_CATEGORY_LABEL[e.category]]
                .filter(Boolean)
                .join(" "),
          }}
          filters={[
            {
              id: "kind",
              name: "Kind",
              options: tabs.map((t) => ({ ...t, count: list.items.filter((e) => inShow(e, t.id)).length })),
              match: (e, v) => inShow(e, v as ExpenseShow),
            },
          ]}
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
          empty={<EmptyBlock icon="Receipt" title={`No expenses in ${list.year}`} action={addButton ?? undefined} />}
        />
      </div>

      {adding ? <AddExpensePanel properties={properties} units={units} onClose={() => setAdding(false)} /> : null}
      {voiding ? <VoidExpenseDialog expense={voiding} onClose={() => setVoiding(null)} /> : null}
      {attaching ? <ReceiptDialog expense={attaching} onClose={() => setAttaching(null)} /> : null}
    </PageContent>
  );
}
