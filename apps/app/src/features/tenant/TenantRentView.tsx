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
  FilterTabs,
  formatDay,
  formatMoney,
  IconAction,
  KpiStrip,
  ListToolbar,
  Money,
  PageContent,
  PageHeader,
  RowActions,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { useState } from "react";
import { days, placeWords, receiptHref } from "../leases/shared";
import { nextRent } from "./format";
import { PayPanel } from "./PayPanel";

const chargeStatus = (c: LeaseChargeView): string => (c.overdue ? "overdue" : c.status);

/** What a payment went to: "Rent for October 2026, Deposit", or its method while nothing was applied. */
function paidFor(p: TenantPaymentView): string {
  if (p.allocations.length === 0)
    return p.status === "succeeded" && p.creditRwf > 0 ? "Credit" : LEASE_PAYMENT_METHOD_LABEL[p.method];
  return p.allocations.map((a) => a.label).join(", ");
}

/** Rent (P3.3): what is owed, every charge, every payment with its receipt, and Pay. */
export function TenantRentView({
  tenancy,
  charges,
  payments,
  today,
}: {
  tenancy: TenancyDetail;
  charges: TenantChargeList;
  payments: TenantPaymentView[];
  today: string;
}) {
  const [paying, setPaying] = useState(false);
  const [only, setOnly] = useState<LeaseChargeView | null>(null);
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";
  const canPay = charges.maxPaymentRwf > 0 && live;
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const paid = succeeded.reduce((s, p) => s + p.amountRwf, 0);
  const upcoming = nextRent(tenancy.terms, charges.charges, today);
  const [tab, setTab] = useState<"payments" | "charges">("payments");
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
    { id: "amount", header: "Amount", align: "end", cell: (p) => <Money value={p.amountRwf} /> },
    { id: "status", header: "Status", cell: (p) => <StatusChip kind="payment" status={p.status} /> },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={placeWords(tenancy)}
        title="Rent"
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
            footnote:
              charges.overdueRwf > 0
                ? `${formatMoney(charges.overdueRwf)} overdue`
                : charges.creditRwf > 0
                  ? `${formatMoney(charges.creditRwf)} credit`
                  : "Nothing overdue",
          },
          {
            id: "next",
            label: "Next rent",
            value: upcoming?.amountRwf ?? 0,
            icon: "Calendar",
            footnote: upcoming ? `Due ${formatDay(upcoming.dueOn, "long")}` : "No month left",
          },
          {
            id: "paid",
            label: "Paid so far",
            value: paid,
            icon: "CircleCheck",
            footnote: `${succeeded.length} ${succeeded.length === 1 ? "payment" : "payments"}`,
          },
          {
            id: "deposit",
            label: "Deposit",
            value: tenancy.terms.depositRwf,
            icon: "Vault",
            footnote: tenancy.charges.depositStatus === "held" ? "Held by your landlord" : undefined,
          },
        ]}
      />
      <SectionCard contentClassName="gap-3">
        <ListToolbar
          tabs={
            <FilterTabs
              label="Show"
              name="Show"
              icon="ListUl"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k === "charges" ? "charges" : "payments")}
              tabs={[
                { id: "payments", label: "Payments", count: payments.length },
                { id: "charges", label: "Charges", count: charges.charges.length },
              ]}
            />
          }
        />
        {tab === "charges" ? (
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
        ) : (
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
        )}
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
