"use client";

import { toast } from "@heroui/react";
import type { PayoutList, PayoutView } from "@injishi/contracts";
import { DataTable, DateText, EmptyBlock, formatMoney, IconAction, Money, SectionCard, StatusChip } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { retryPayout } from "../actions";

/**
 * The rent Injishi sent on to the business (Getting paid): each payout with the tenant's payment it came
 * from, where it went and where it stands; a failed or held one can be sent again to the primary account.
 */
export function Payouts({ list, canRetry }: { list: PayoutList | null; canRetry: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!list) return null;
  const { totals } = list;
  const waiting = totals.queuedRwf + totals.heldRwf;
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
    <SectionCard
      title="Payouts"
      description={
        list.payouts.length === 0
          ? undefined
          : `${formatMoney(totals.paidRwf)} paid out${waiting > 0 ? `, ${formatMoney(waiting)} on the way` : ""}${
              totals.failedRwf > 0 ? `, ${formatMoney(totals.failedRwf)} failed` : ""
            }`
      }
      contentClassName="gap-0"
    >
      <DataTable<PayoutView>
        label="Payouts"
        rows={list.payouts}
        rowKey={(p) => p.id}
        defaultSort={{ column: "date", direction: "descending" }}
        empty={
          <EmptyBlock
            size="sm"
            icon="Wallet"
            title="No payouts yet"
            description="When a tenant pays through Injishi, the money is sent to your primary account."
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
    </SectionCard>
  );
}
