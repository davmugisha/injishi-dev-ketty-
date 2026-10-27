"use client";

import type { BrokerEarnings, BrokerFeeLine, BrokerReviews } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  formatMoney,
  KpiStrip,
  ListToolbar,
  PageContent,
  PageHeader,
} from "@injishi/ui";
import { useState } from "react";
import { FeesChart } from "./FeesChart";
import { ReviewsSection } from "./ReviewsView";
import { FeeChip, feeTermsWords } from "./shared";

type Tab = "all" | "owed" | "paid";

/**
 * What landlords recorded as owed to the broker and paid (2026-10-25). A record: the money moves between
 * the landlord and the broker, outside Injishi, and the landlord marks it paid.
 */
export function EarningsView({
  data,
  reviews,
  today,
}: {
  data: BrokerEarnings;
  /** What landlords and tenants said, shown under the fees (2026-10-27). */
  reviews: BrokerReviews;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const owed = data.fees.filter((f) => f.fee.status === "owed");
  const paid = data.fees.filter((f) => f.fee.status === "paid");
  const rows = tab === "owed" ? owed : tab === "paid" ? paid : data.fees;
  const columns: DataColumn<BrokerFeeLine>[] = [
    {
      id: "lease",
      header: "Lease",
      isRowHeader: true,
      cell: (f) => (
        <span className="flex flex-col">
          <span className="font-medium">{f.tenantName}</span>
          <span className="text-xs text-muted">
            {f.unitLabel} · {f.propertyName}
          </span>
        </span>
      ),
      sortValue: (f) => f.tenantName,
    },
    { id: "landlord", header: "Landlord", cell: (f) => f.landlordName, hideBelow: "lg" },
    { id: "start", header: "Starts", cell: (f) => formatDay(f.startDate, "short"), sortValue: (f) => f.startDate },
    { id: "terms", header: "Agreed", cell: (f) => feeTermsWords(f.fee.terms), hideBelow: "lg" },
    {
      id: "amount",
      header: "Fee",
      align: "end",
      cell: (f) => <span className="tabular">{formatMoney(f.fee.amountRwf)}</span>,
      sortValue: (f) => f.fee.amountRwf,
    },
    {
      id: "status",
      header: "Status",
      cell: (f) => (
        <span className="flex flex-col items-start gap-0.5">
          <FeeChip status={f.fee.status} />
          {f.fee.paidAt ? <span className="text-xs text-muted">{formatDay(f.fee.paidAt, "short")}</span> : null}
        </span>
      ),
    },
  ];
  return (
    <PageContent>
      <PageHeader title="Earnings and reviews" />
      <KpiStrip
        label="Fees"
        items={[
          {
            id: "owed",
            label: "Owed to you",
            value: data.owedRwf,
            icon: "Wallet",
            status: data.owedRwf > 0 ? "warning" : undefined,
            isCurrent: tab === "owed",
          },
          { id: "paid", label: "Paid", value: data.paidRwf, icon: "CircleCheck", isCurrent: tab === "paid" },
          { id: "year", label: "Paid this year", value: data.paidThisYearRwf, icon: "Calendar" },
        ]}
      />
      <FeesChart fees={data.fees} today={today} />
      <ListToolbar
        tabs={
          <FilterTabs
            label="Fees by status"
            name="Status"
            tabs={[
              { id: "all", label: "All", count: data.fees.length },
              { id: "owed", label: "Owed", count: owed.length },
              { id: "paid", label: "Paid", count: paid.length },
            ]}
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as Tab)}
          />
        }
      >
        <span className="hidden text-xs text-muted md:inline">
          Landlords pay you directly; Injishi keeps the record.
        </span>
      </ListToolbar>
      <DataTable
        label="Fees"
        rows={rows}
        rowKey={(f) => f.leaseId}
        columns={columns}
        defaultSort={{ column: "start", direction: "descending" }}
        mobile={{
          title: (f) => f.tenantName,
          description: (f) => `${f.unitLabel} · ${f.propertyName}`,
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
            title="No fees recorded yet"
            description="A fee is recorded when a landlord names you on a lease."
            action={
              <ActionLink href={screenHref("BrokerPlacements")} icon="Persons">
                See placements
              </ActionLink>
            }
          />
        }
      />
      <ReviewsSection data={reviews} />
    </PageContent>
  );
}
