"use client";

import type { BrokerEarnings, BrokerFeeLine } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  formatMoney,
  Money,
  PageContent,
} from "@injishi/ui";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { FeeChip, feeTermsWords } from "./shared";

/**
 * The fees landlords recorded for the broker, owed and paid (2026-10-30): one table with a status filter
 * and a search. The money moves between the landlord and the broker outside Injishi.
 */
export function EarningsView({ data }: { data: BrokerEarnings }) {
  const count = (s: BrokerFeeLine["fee"]["status"]) => data.fees.filter((f) => f.fee.status === s).length;
  const columns: DataColumn<BrokerFeeLine>[] = [
    {
      id: "lease",
      header: "Tenant",
      isRowHeader: true,
      sortValue: (f) => f.tenantName,
      cell: (f) => (
        <span className="flex flex-col">
          <span className="font-medium">{f.tenantName}</span>
          <span className="text-xs text-muted">
            {f.unitLabel} · {f.propertyName}
          </span>
        </span>
      ),
    },
    {
      id: "landlord",
      header: "Landlord",
      sortValue: (f) => f.landlordName,
      cell: (f) => f.landlordName,
      hideBelow: "lg",
    },
    {
      id: "start",
      header: "Lease starts",
      sortValue: (f) => f.startDate,
      cell: (f) => <DateText value={f.startDate} />,
    },
    { id: "terms", header: "Agreed", cell: (f) => feeTermsWords(f.fee.terms), hideBelow: "lg", defaultHidden: true },
    {
      id: "amount",
      header: "Fee",
      align: "end",
      sortValue: (f) => f.fee.amountRwf,
      cell: (f) => <Money value={f.fee.amountRwf} />,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (f) => f.fee.status,
      cell: (f) => <FeeChip status={f.fee.status} />,
    },
    {
      id: "paid",
      header: "Paid on",
      sortValue: (f) => f.fee.paidAt ?? "",
      cell: (f) =>
        f.fee.paidAt ? <DateText value={f.fee.paidAt.slice(0, 10)} /> : <span className="text-muted">-</span>,
    },
  ];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="Fees"
        noun={{ one: "fee", many: "fees" }}
        rows={data.fees}
        rowKey={(f) => f.leaseId}
        columns={columns}
        columnToggle
        defaultSort={{ column: "start", direction: "descending" }}
        search={{
          placeholder: "Tenant, home or landlord",
          text: (f) => `${f.tenantName} ${f.unitLabel} ${f.propertyName} ${f.landlordName}`,
        }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All", count: data.fees.length },
              { id: "owed", label: "Owed", count: count("owed") },
              { id: "paid", label: "Paid", count: count("paid") },
              { id: "void", label: "Void", count: count("void") },
            ].filter((o) => o.id !== "void" || o.count > 0),
            match: (f, v) => f.fee.status === v,
          },
        ]}
        mobile={{
          title: (f) => f.tenantName,
          description: (f) => `${f.unitLabel} · ${formatDay(f.startDate)}`,
          trailing: (f) => (
            <span className="flex flex-col items-end gap-1">
              <span className="tabular">{formatMoney(f.fee.amountRwf)}</span>
              <FeeChip status={f.fee.status} />
            </span>
          ),
        }}
        empty={
          <EmptyBlock
            icon="Wallet"
            title="No fees yet"
            description="A fee is recorded when a landlord names you on a lease."
            action={
              <ActionLink href={screenHref("BrokerPlacements")} icon="Persons">
                Placements
              </ActionLink>
            }
          />
        }
      />
    </PageContent>
  );
}
