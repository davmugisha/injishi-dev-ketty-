"use client";

import { toast } from "@heroui/react";
import type { PayoutList, PayoutView } from "@injishi/contracts";
import { DataTable, DateText, EmptyBlock, formatMoney, IconAction, Money, PageContent, StatusChip } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { retryPayout } from "./actions";

/**
 * The rent Injishi sent on to the business (Money > Payouts): each payout with the tenant's payment it
 * came from, where it went and where it stands; a failed or held one can be sent again to the primary
 * account. One table with a status filter and a search.
 */
export function PayoutsView({ list, canRetry }: { list: PayoutList; canRetry: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const retry = async (p: PayoutView) => {
    setBusy(p.id);
    const result = await retryPayout(p.id);
    setBusy(null);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    toast.success(`${formatMoney(p.amountRwf)} sent again`);
    router.refresh();
  };
  return (
    <PageContent>
      <AreaHeader />
      <DataTable<PayoutView>
        label="Payouts"
        rows={list.payouts}
        rowKey={(p) => p.id}
        defaultSort={{ column: "date", direction: "descending" }}
        noun={{ one: "payout", many: "payouts" }}
        search={{
          placeholder: "Tenant or lease",
          text: (p) => `${p.payment?.tenantName ?? ""} ${p.payment?.leaseReference ?? ""}`,
        }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All" },
              { id: "paid", label: "Paid out" },
              { id: "on_the_way", label: "On the way" },
              { id: "failed", label: "Failed or held" },
            ],
            match: (p, v) =>
              v === "paid"
                ? p.status === "paid"
                : v === "failed"
                  ? p.status === "failed" || p.status === "held"
                  : p.status === "queued" || p.status === "scheduled",
          },
        ]}
        empty={
          <EmptyBlock
            icon="Wallet"
            title="No payouts yet"
            description="Rent paid through Injishi goes to your primary account."
          />
        }
        columns={[
          {
            id: "date",
            header: "Date",
            sortValue: (p) => p.createdAt,
            cell: (p) => <DateText value={p.settledAt ?? p.createdAt} />,
          },
          {
            id: "from",
            header: "From",
            isRowHeader: true,
            cell: (p) =>
              p.payment ? (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate">{p.payment.tenantName}</span>
                  <span className="truncate text-xs text-muted">
                    {p.payment.leaseReference}
                    {p.payment.receiptNumber ? ` · ${p.payment.receiptNumber}` : ""}
                  </span>
                </div>
              ) : (
                "Rent"
              ),
          },
          {
            id: "to",
            header: "Sent to",
            hideBelow: "lg",
            cell: (p) => <span className="text-sm">{p.destination ?? "No account yet"}</span>,
          },
          {
            id: "amount",
            header: "Amount",
            align: "end",
            sortValue: (p) => p.amountRwf,
            cell: (p) => <Money value={p.amountRwf} />,
          },
          {
            id: "status",
            header: "Status",
            sortValue: (p) => p.status,
            cell: (p) => <StatusChip kind="payout" status={p.status} />,
          },
        ]}
        rowActions={
          canRetry
            ? (p) =>
                p.status === "failed" || p.status === "held" ? (
                  <IconAction
                    icon="ArrowRotateRight"
                    label={`Send ${formatMoney(p.amountRwf)} again`}
                    isDisabled={busy === p.id}
                    onPress={() => void retry(p)}
                  />
                ) : null
            : undefined
        }
        mobile={{
          title: (p) => p.payment?.tenantName ?? "Rent",
          description: (p) => `${p.destination ?? "No account yet"} · ${p.payment?.leaseReference ?? ""}`,
          trailing: (p) => (
            <div className="flex flex-col items-end gap-1">
              <Money value={p.amountRwf} className="text-sm font-medium" />
              <StatusChip kind="payout" status={p.status} />
            </div>
          ),
        }}
      />
    </PageContent>
  );
}
