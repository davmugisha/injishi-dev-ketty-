"use client";

import { Toast } from "@heroui/react";
import {
  LEASE_PAYMENT_CHANNEL_LABEL,
  LEASE_PAYMENT_METHOD_LABEL,
  type LeaseChargeView,
  type TenancyDetail,
  type TenantChargeList,
  type TenantPaymentView,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  formatMoney,
  IconAction,
  Money,
  PageContent,
  RowActions,
  StatusChip,
} from "@injishi/ui";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { days, placeWords, receiptHref } from "../leases/shared";
import { PayPanel } from "./PayPanel";

const chargeStatus = (c: LeaseChargeView): string => (c.overdue ? "overdue" : c.status);

/** What a payment went to: "Rent for October 2026, Deposit", or its method while nothing was applied. */
function paidFor(p: TenantPaymentView): string {
  if (p.allocations.length === 0)
    return p.status === "succeeded" && p.creditRwf > 0 ? "Credit" : LEASE_PAYMENT_METHOD_LABEL[p.method];
  return p.allocations.map((a) => a.label).join(", ");
}

/** The Pay button and panel of the Rent tabs: the whole balance, or one charge. */
function usePay(tenancy: TenancyDetail, charges: TenantChargeList) {
  const [paying, setPaying] = useState(false);
  const [only, setOnly] = useState<LeaseChargeView | null>(null);
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";
  const canPay = charges.maxPaymentRwf > 0 && live;
  const open = (charge: LeaseChargeView | null = null) => {
    setOnly(charge);
    setPaying(true);
  };
  const button =
    canPay || charges.pendingPaymentId ? (
      <ActionButton icon="Wallet" intent="primary" onPress={() => open()}>
        {charges.pendingPaymentId ? "Payment waiting" : "Pay rent"}
      </ActionButton>
    ) : null;
  const panel = paying ? (
    <PayPanel
      leaseId={tenancy.id}
      charges={charges}
      phone={tenancy.tenant.phone}
      waitingId={charges.pendingPaymentId}
      only={only}
      onClose={() => setPaying(false)}
    />
  ) : null;
  return { canPay, open, button, panel };
}

/** Rent > Payments: every payment with its receipt, in one table. */
export function TenantPaymentsView({
  tenancy,
  charges,
  payments,
}: {
  tenancy: TenancyDetail;
  charges: TenantChargeList;
  payments: TenantPaymentView[];
}) {
  const pay = usePay(tenancy, charges);
  const open = (url: string) => window.open(url, "_blank", "noopener");
  const paymentColumns: DataColumn<TenantPaymentView>[] = [
    {
      id: "on",
      header: "Date",
      isRowHeader: true,
      sortValue: (p) => p.paidOn ?? p.createdAt,
      cell: (p) => <DateText value={p.paidOn ?? p.createdAt} />,
    },
    {
      id: "for",
      header: "For",
      cell: (p) => (
        <span className="flex max-w-80 min-w-0 flex-col">
          <span className="truncate">
            {p.status === "succeeded" ? paidFor(p) : p.status === "pending" ? p.statusWords : "Nothing taken"}
          </span>
          {p.status === "failed" && p.failureReason ? (
            <span className="truncate text-xs text-muted" title={p.failureReason}>
              {p.failureReason}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "how",
      header: "How",
      hideBelow: "lg",
      cell: (p) => (
        <span className="flex flex-col whitespace-nowrap">
          <span>{LEASE_PAYMENT_METHOD_LABEL[p.method]}</span>
          <span className="text-xs text-muted">{p.payerMasked ?? LEASE_PAYMENT_CHANNEL_LABEL[p.channel]}</span>
        </span>
      ),
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
      cell: (p) => <StatusChip kind="payment" status={p.status} />,
    },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader eyebrow={placeWords(tenancy)} actions={pay.button} />
      <DataTable
        label="Payments"
        noun={{ one: "payment", many: "payments" }}
        rows={payments}
        rowKey={(p) => p.id}
        columns={paymentColumns}
        defaultSort={{ column: "on", direction: "descending" }}
        search={{ placeholder: "What it paid for or receipt", text: (p) => `${paidFor(p)} ${p.receiptNumber ?? ""}` }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All" },
              { id: "succeeded", label: "Paid" },
              { id: "pending", label: "Waiting" },
              { id: "failed", label: "Failed" },
            ],
            match: (p, v) => (v === "failed" ? p.status !== "succeeded" && p.status !== "pending" : p.status === v),
          },
        ]}
        rowActions={(p) =>
          p.status !== "succeeded" ? null : (
            <RowActions>
              <IconAction
                icon="FileArrowDown"
                label={p.receiptNumber ? `Receipt ${p.receiptNumber}` : "Receipt"}
                disabledReason={p.receiptReady ? null : "Being made"}
                onPress={() => open(receiptHref(tenancy.id, p.id))}
              />
            </RowActions>
          )
        }
        mobile={{
          title: (p) => formatMoney(p.amountRwf),
          description: (p) =>
            [formatDay(p.paidOn ?? p.createdAt), paidFor(p), p.receiptNumber].filter(Boolean).join(" · "),
          trailing: (p) => <StatusChip kind="payment" status={p.status} />,
        }}
        empty={<EmptyBlock icon="Wallet" title="No payments yet" action={pay.button ?? undefined} />}
      />
      {pay.panel}
    </PageContent>
  );
}

/** Rent > Charges: every rent and deposit charge with what is still owed; pay one from its row. */
export function TenantChargesView({ tenancy, charges }: { tenancy: TenancyDetail; charges: TenantChargeList }) {
  const pay = usePay(tenancy, charges);
  const chargeColumns: DataColumn<LeaseChargeView>[] = [
    { id: "what", header: "Charge", isRowHeader: true, cell: (c) => c.label },
    { id: "due", header: "Due", sortValue: (c) => c.dueOn, cell: (c) => <DateText value={c.dueOn} /> },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      sortValue: (c) => c.amountRwf,
      cell: (c) => <Money value={c.amountRwf} />,
    },
    {
      id: "owed",
      header: "Still owed",
      align: "end",
      cell: (c) =>
        c.outstandingRwf > 0 ? <Money value={c.outstandingRwf} /> : <span className="text-muted">RWF 0</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => (
        <StatusChip kind="charge" status={chargeStatus(c)}>
          {c.overdue ? `${days(c.daysOverdue)} late` : c.status === "open" ? "To pay" : undefined}
        </StatusChip>
      ),
    },
  ];
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader eyebrow={placeWords(tenancy)} actions={pay.button} />
      <DataTable
        label="Charges"
        noun={{ one: "charge", many: "charges" }}
        rows={charges.charges}
        rowKey={(c) => c.id}
        columns={chargeColumns}
        defaultSort={{ column: "due", direction: "descending" }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All" },
              { id: "overdue", label: "Overdue" },
              { id: "open", label: "To pay" },
              { id: "paid", label: "Paid" },
            ],
            match: (c, v) => chargeStatus(c) === v,
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
        rowActions={
          pay.canPay
            ? (c) =>
                c.outstandingRwf > 0 ? (
                  <RowActions>
                    <IconAction icon="Wallet" label={`Pay ${c.label.toLowerCase()}`} onPress={() => pay.open(c)} />
                  </RowActions>
                ) : null
            : undefined
        }
        mobile={{
          title: (c) => c.label,
          description: (c) => `Due ${formatDay(c.dueOn)} · ${formatMoney(c.amountRwf)}`,
          trailing: (c) => (
            <StatusChip kind="charge" status={chargeStatus(c)}>
              {c.status === "open" && !c.overdue ? "To pay" : undefined}
            </StatusChip>
          ),
        }}
        empty={<EmptyBlock icon="Receipt" title="Nothing charged yet" />}
      />
      {pay.panel}
    </PageContent>
  );
}
