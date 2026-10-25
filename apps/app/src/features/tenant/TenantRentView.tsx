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
  KpiStrip,
  Money,
  PageContent,
  PageHeader,
  RowActions,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { useState } from "react";
import { days, receiptHref } from "../leases/shared";
import { PayPanel } from "./PayPanel";
import { placeWords } from "./TenantOverviewView";

const chargeStatus = (c: LeaseChargeView): string => (c.overdue ? "overdue" : c.status);

/** Rent (P3.3): what is owed, every charge, every payment with its receipt, and Pay. */
export function TenantRentView({
  tenancy,
  charges,
  payments,
}: {
  tenancy: TenancyDetail;
  charges: TenantChargeList;
  payments: TenantPaymentView[];
}) {
  const [paying, setPaying] = useState(false);
  const [only, setOnly] = useState<LeaseChargeView | null>(null);
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";
  const canPay = charges.maxPaymentRwf > 0 && live;
  const paid = payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amountRwf, 0);
  const open = (url: string) => window.open(url, "_blank", "noopener");

  const chargeColumns: DataColumn<LeaseChargeView>[] = [
    { id: "what", header: "Charge", isRowHeader: true, cell: (c) => c.label },
    { id: "due", header: "Due", sortValue: (c) => c.dueOn, cell: (c) => <DateText value={c.dueOn} /> },
    { id: "amount", header: "Amount", align: "end", cell: (c) => <Money value={c.amountRwf} /> },
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
  const paymentColumns: DataColumn<TenantPaymentView>[] = [
    {
      id: "on",
      header: "Paid on",
      isRowHeader: true,
      sortValue: (p) => p.paidOn ?? p.createdAt,
      cell: (p) => <DateText value={p.paidOn ?? p.createdAt} />,
    },
    {
      id: "how",
      header: "How",
      cell: (p) => `${LEASE_PAYMENT_METHOD_LABEL[p.method]} · ${LEASE_PAYMENT_CHANNEL_LABEL[p.channel]}`,
    },
    {
      id: "receipt",
      header: "Receipt",
      hideBelow: "lg",
      cell: (p) => p.receiptNumber ?? <span className="text-muted">-</span>,
    },
    { id: "amount", header: "Amount", align: "end", cell: (p) => <Money value={p.amountRwf} /> },
    { id: "status", header: "Status", cell: (p) => <StatusChip kind="payment" status={p.status} /> },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={placeWords(tenancy)}
        title="Rent"
        description="What you owe, what you paid, and your receipts."
        actions={
          canPay || charges.pendingPaymentId ? (
            <ActionButton
              icon="Wallet"
              intent="primary"
              onPress={() => {
                setOnly(null);
                setPaying(true);
              }}
            >
              {charges.pendingPaymentId ? "Payment waiting" : "Pay rent"}
            </ActionButton>
          ) : null
        }
      />
      <KpiStrip
        label="Your rent at a glance"
        items={[
          {
            id: "owed",
            label: "Owed now",
            value: charges.outstandingRwf,
            icon: "Receipt",
            status: charges.overdueRwf > 0 ? "danger" : charges.outstandingRwf > 0 ? "warning" : undefined,
            footnote: charges.overdueRwf > 0 ? `${formatMoney(charges.overdueRwf)} overdue` : "Nothing overdue",
          },
          { id: "rent", label: "Rent a month", value: tenancy.terms.monthlyRentRwf, icon: "Wallet" },
          { id: "paid", label: "Paid so far", value: paid, icon: "CircleCheck" },
          {
            id: "credit",
            label: "Credit",
            value: charges.creditRwf,
            icon: "Vault",
            footnote: charges.creditRwf > 0 ? "Goes to your next rent" : "Nothing paid ahead",
          },
        ]}
      />
      <SectionCard title="Charges" description="Raised a week before each due day." contentClassName="gap-0">
        <DataTable
          label="Charges"
          rows={charges.charges}
          rowKey={(c) => c.id}
          columns={chargeColumns}
          defaultSort={{ column: "due", direction: "descending" }}
          rowActions={
            canPay
              ? (c) =>
                  c.outstandingRwf > 0 ? (
                    <RowActions>
                      <IconAction
                        icon="Wallet"
                        label={`Pay ${c.label.toLowerCase()}`}
                        onPress={() => {
                          setOnly(c);
                          setPaying(true);
                        }}
                      />
                    </RowActions>
                  ) : null
              : undefined
          }
          mobile={{
            title: (c) => c.label,
            description: (c) => `Due ${formatDay(c.dueOn)} · ${formatMoney(c.amountRwf)}`,
            trailing: (c) => <StatusChip kind="charge" status={chargeStatus(c)} />,
          }}
          empty={
            <EmptyBlock
              size="sm"
              icon="Receipt"
              title="Nothing charged yet"
              description="The first rent is raised a week before it is due."
            />
          }
        />
      </SectionCard>
      <SectionCard title="Payments" contentClassName="gap-0">
        <DataTable
          label="Payments"
          rows={payments}
          rowKey={(p) => p.id}
          columns={paymentColumns}
          defaultSort={{ column: "on", direction: "descending" }}
          rowActions={(p) =>
            p.status !== "succeeded" ? null : (
              <RowActions>
                <IconAction
                  icon="FileArrowDown"
                  label={`Receipt ${p.receiptNumber ?? ""}`.trim()}
                  disabledReason={p.receiptReady ? null : "Being made"}
                  onPress={() => open(receiptHref(tenancy.id, p.id))}
                />
              </RowActions>
            )
          }
          mobile={{
            title: (p) => formatMoney(p.amountRwf),
            description: (p) =>
              [formatDay(p.paidOn ?? p.createdAt), LEASE_PAYMENT_METHOD_LABEL[p.method], p.receiptNumber]
                .filter(Boolean)
                .join(" · "),
            trailing: (p) => <StatusChip kind="payment" status={p.status} />,
          }}
          empty={
            <EmptyBlock
              size="sm"
              icon="Wallet"
              title="No payments yet"
              action={
                canPay ? (
                  <ActionButton icon="Wallet" intent="primary" onPress={() => setPaying(true)}>
                    Pay rent
                  </ActionButton>
                ) : undefined
              }
            />
          }
        />
      </SectionCard>
      {paying ? (
        <PayPanel
          leaseId={tenancy.id}
          charges={charges}
          phone={tenancy.tenant.phone}
          waitingId={charges.pendingPaymentId}
          only={only}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </PageContent>
  );
}
