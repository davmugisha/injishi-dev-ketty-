"use client";

import type { RentalsMoneyCharge } from "@injishi/contracts";
import {
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  formatMoney,
  IconAction,
  Money,
  PageContent,
  PersonCell,
  RowActions,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { leaseHref } from "@/features/leases/shared";

const KIND_WORD: Record<RentalsMoneyCharge["kind"], string> = { rent: "Rent", deposit: "Deposit" };

/**
 * Every rent and deposit charge of the business with what was paid on it (2026-10-30): one table with a
 * search, status and type filters, newest due first. Rent is paid through the payment integration only;
 * a row opens its lease, where reminders are sent.
 */
export function RentView({ charges, today }: { charges: RentalsMoneyCharge[]; today: string }) {
  const router = useRouter();
  const columns: DataColumn<RentalsMoneyCharge>[] = [
    {
      id: "due",
      header: "Due",
      sortValue: (c) => c.dueOn,
      cell: (c) => <DateText value={c.dueOn} />,
    },
    {
      id: "tenant",
      header: "Tenant",
      isRowHeader: true,
      sortValue: (c) => c.tenantName,
      cell: (c) => <PersonCell name={c.tenantName} secondary={c.unitLabel} />,
    },
    { id: "kind", header: "Type", sortValue: (c) => c.kind, cell: (c) => KIND_WORD[c.kind] },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      sortValue: (c) => c.amountRwf,
      cell: (c) => <Money value={c.amountRwf} />,
    },
    { id: "paid", header: "Paid", align: "end", sortValue: (c) => c.paidRwf, cell: (c) => <Money value={c.paidRwf} /> },
    {
      id: "status",
      header: "Status",
      sortValue: (c) => c.status,
      cell: (c) => (
        <StatusChip kind="charge" status={c.status}>
          {c.status === "open" ? "Due" : undefined}
        </StatusChip>
      ),
    },
  ];
  const count = (s: RentalsMoneyCharge["status"]) => charges.filter((c) => c.status === s).length;
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="Rent"
        noun={{ one: "charge", many: "charges" }}
        rows={charges}
        rowKey={(c) => c.id}
        columns={columns}
        columnToggle
        defaultSort={{ column: "due", direction: "descending" }}
        search={{ placeholder: "Tenant or unit", text: (c) => `${c.tenantName} ${c.unitLabel}` }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All" },
              { id: "overdue", label: "Overdue", count: count("overdue") },
              { id: "open", label: "Due", count: count("open") },
              { id: "paid", label: "Paid", count: count("paid") },
            ],
            match: (c, v) => c.status === v,
          },
          {
            id: "kind",
            name: "Type",
            icon: "Tag",
            options: [
              { id: "all", label: "All" },
              { id: "rent", label: "Rent" },
              { id: "deposit", label: "Deposit" },
            ],
            match: (c, v) => c.kind === v,
          },
        ]}
        onRowAction={(c) => router.push(leaseHref(c.leaseId))}
        rowActions={(c) => (
          <RowActions>
            {c.status !== "paid" && c.dueOn <= today ? (
              <IconAction
                icon="Bell"
                label="Send a reminder"
                onPress={() => router.push(`${leaseHref(c.leaseId)}?open=remind`)}
              />
            ) : null}
            <IconAction icon="ChevronRight" label="Open lease" onPress={() => router.push(leaseHref(c.leaseId))} />
          </RowActions>
        )}
        mobile={{
          title: (c) => c.tenantName,
          description: (c) =>
            `${formatDay(c.dueOn)} · ${c.unitLabel} · ${KIND_WORD[c.kind]} · ${formatMoney(c.amountRwf)}`,
          trailing: (c) => (
            <StatusChip kind="charge" status={c.status}>
              {c.status === "open" ? "Due" : undefined}
            </StatusChip>
          ),
        }}
        empty={<EmptyBlock icon="Wallet" title="No rent yet" description="Charges appear once a lease starts." />}
      />
    </PageContent>
  );
}
