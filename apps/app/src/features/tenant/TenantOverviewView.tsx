"use client";

import { Alert, Card, Toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import {
  daysBetween,
  LEASE_PAYMENT_METHOD_LABEL,
  type LeaseChargeView,
  nationalPhone,
  type TenancyDetail,
  type TenantChargeList,
  type TenantPaymentView,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DateText,
  formatDay,
  formatMoney,
  Icon,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dueDayWords, placeWords, tenantGuestsHref, tenantLeaseHref, tenantRentHref } from "../leases/shared";
import { PayPanel } from "./PayPanel";

/** What is owed now, in one sentence and a tone. */
export function owedWords(charges: TenantChargeList): { title: string; tone: "danger" | "warning" | "success" } {
  if (charges.overdueRwf > 0) return { title: `${formatMoney(charges.overdueRwf)} is overdue`, tone: "danger" };
  if (charges.outstandingRwf > 0) {
    const next = [...charges.charges]
      .filter((c) => c.outstandingRwf > 0)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
    return { title: next ? `Due ${formatDay(next.dueOn, "long")}` : "Due now", tone: "warning" };
  }
  return { title: "You are up to date", tone: "success" };
}

/**
 * The tenant's home (P3.1): what is owed now with a Pay button, the lease waiting for their signature,
 * the short facts of the lease, the landlord to call, and the latest payments.
 */
export function TenantOverviewView({
  tenancy,
  charges,
  payments,
  firstName,
  today,
  openPay,
}: {
  tenancy: TenancyDetail;
  charges: TenantChargeList | null;
  payments: TenantPaymentView[];
  firstName: string;
  today: string;
  openPay: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [paying, setPaying] = useState(false);
  const [only, setOnly] = useState<LeaseChargeView | null>(null);
  const deposit = charges?.charges.find((c) => c.kind === "deposit" && c.outstandingRwf > 0) ?? null;
  const pay = (charge: LeaseChargeView | null = null) => {
    setOnly(charge);
    setPaying(true);
  };
  const t = tenancy.terms;
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";
  const canPay = Boolean(charges && charges.maxPaymentRwf > 0 && live);
  const left = daysBetween(today, t.endDate);

  useEffect(() => {
    if (!openPay) return;
    if (canPay || charges?.pendingPaymentId) setPaying(true);
    router.replace(pathname, { scroll: false });
  }, [openPay, canPay, charges, pathname, router]);

  const owed = charges ? owedWords(charges) : null;
  const todo: {
    id: string;
    title: string;
    detail: string;
    href?: string;
    press?: () => void;
    icon: "FileText" | "Wallet" | "PersonPlus";
  }[] = [];
  if (tenancy.needsMySignature)
    todo.push({
      id: "sign",
      title: "Sign your lease",
      detail: `${tenancy.landlord.name} signed it. Read it and sign.`,
      href: `${tenantLeaseHref(tenancy.id)}?sign=1`,
      icon: "FileText",
    });
  if (canPay && deposit)
    todo.push({
      id: "deposit",
      title: "Pay your deposit",
      detail: `${formatMoney(deposit.outstandingRwf)}, due ${formatDay(deposit.dueOn, "long")}`,
      press: () => pay(deposit),
      icon: "Wallet",
    });
  if (canPay && charges && charges.overdueRwf > 0)
    todo.push({
      id: "pay",
      title: "Pay what is overdue",
      detail: owed?.title ?? "",
      press: () => pay(),
      icon: "Wallet",
    });
  if (tenancy.status === "active" || tenancy.status === "signed")
    todo.push({
      id: "guests",
      title: "Expecting a guest overnight?",
      detail: "Register them. It goes to the local leaders.",
      href: tenantGuestsHref(tenancy.id),
      icon: "PersonPlus",
    });

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        size="hello"
        eyebrow={placeWords(tenancy)}
        title={firstName ? `Hello, ${firstName}` : "Your home"}
        description={
          tenancy.status === "pending_signature"
            ? tenancy.needsMySignature
              ? "Your lease is waiting for your signature."
              : "Waiting for your landlord."
            : tenancy.status === "signed"
              ? `Signed by both. Your tenancy starts ${formatDay(t.startDate, "long")}.`
              : tenancy.status === "cancelled"
                ? "This lease was cancelled."
                : tenancy.status === "ended"
                  ? "This lease has ended."
                  : `Your lease runs to ${formatDay(t.endDate, "long")}.`
        }
        actions={
          tenancy.needsMySignature ? (
            <ActionLink href={`${tenantLeaseHref(tenancy.id)}?sign=1`} icon="PencilToSquare" intent="primary">
              Review and sign
            </ActionLink>
          ) : null
        }
      />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted">What you owe now</span>
                <span className="text-3xl font-semibold tabular">
                  {charges ? formatMoney(charges.outstandingRwf) : formatMoney(tenancy.charges.balanceRwf)}
                </span>
                {owed ? <span className="text-sm text-muted">{owed.title}</span> : null}
              </div>
              {owed ? (
                <StatusChip tone={owed.tone} size="md">
                  {owed.tone === "danger" ? "Overdue" : owed.tone === "warning" ? "Due" : "Up to date"}
                </StatusChip>
              ) : null}
            </div>
            {charges?.pendingPaymentId ? (
              <Alert status="accent">
                <Alert.Indicator>
                  <Icon name="Smartphone" />
                </Alert.Indicator>
                <Alert.Content className="gap-2">
                  <Alert.Title className="text-sm">
                    A payment is waiting for you to approve it on your phone.
                  </Alert.Title>
                  <ActionButton size="sm" className="self-start" onPress={() => pay()}>
                    See where it is
                  </ActionButton>
                </Alert.Content>
              </Alert>
            ) : null}
            {charges && charges.creditRwf > 0 ? (
              <p className="text-sm text-muted">{formatMoney(charges.creditRwf)} credit goes to your next rent.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {canPay ? (
                <ActionButton icon="Wallet" intent="primary" onPress={() => pay()}>
                  Pay with MoMo or Airtel
                </ActionButton>
              ) : null}
              <ActionLink href={tenantRentHref(tenancy.id)} icon="Receipt" intent="ghost">
                Rent and receipts
              </ActionLink>
            </div>
          </Card>

          {todo.length > 0 ? (
            <SectionCard title="To do" contentClassName="gap-0">
              <ListView
                aria-label="To do"
                variant="secondary"
                items={todo}
                onAction={(key) => {
                  const item = todo.find((i) => i.id === String(key));
                  if (item?.href) router.push(item.href);
                  else item?.press?.();
                }}
              >
                {(item) => (
                  <ListView.Item id={item.id} textValue={item.title} className="cursor-pointer items-start">
                    <ListView.ItemContent className="items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
                        <Icon name={item.icon} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <ListView.Title className="whitespace-normal">{item.title}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{item.detail}</ListView.Description>
                      </span>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="self-center text-muted">
                      <Icon name="ChevronRight" />
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Latest payments"
            actions={
              payments.length > 0 ? (
                <ActionLink href={tenantRentHref(tenancy.id)} size="sm" intent="ghost">
                  All payments
                </ActionLink>
              ) : null
            }
          >
            {payments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-separator">
                {payments.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{LEASE_PAYMENT_METHOD_LABEL[p.method]}</span>
                      <span className="text-xs text-muted">
                        {formatDay(p.paidOn ?? p.createdAt)}
                        {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Money value={p.amountRwf} />
                      <StatusChip kind="payment" status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Your lease">
            <KeyValueList
              items={[
                { label: "Rent", value: <Money value={t.monthlyRentRwf} /> },
                { label: "Due", value: dueDayWords(t.rentDueDay) },
                {
                  label: "Deposit",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <Money value={t.depositRwf} />
                      {tenancy.charges.depositStatus ? (
                        <StatusChip kind="deposit" status={tenancy.charges.depositStatus} />
                      ) : null}
                    </span>
                  ),
                },
                {
                  label: "Ends",
                  value: (
                    <>
                      <DateText value={t.endDate} />
                      {live && left >= 0 ? <span className="font-normal text-muted"> · {left} days left</span> : null}
                    </>
                  ),
                },
              ]}
            />
            <ActionLink href={tenantLeaseHref(tenancy.id)} size="sm" icon="FileText" className="self-start">
              Read the lease
            </ActionLink>
          </SectionCard>
          <SectionCard title="Your landlord">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{tenancy.landlord.name}</span>
              {tenancy.landlord.signatoryName ? (
                <span className="text-sm text-muted">{tenancy.landlord.signatoryName}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionLink href={`/home/${tenancy.id}/messages`} size="sm" icon="Comments">
                Message
              </ActionLink>
              {tenancy.landlord.phone ? (
                <ActionLink href={`tel:${tenancy.landlord.phone}`} size="sm" icon="Handset">
                  <span className="tabular">{nationalPhone(tenancy.landlord.phone)}</span>
                </ActionLink>
              ) : null}
              {tenancy.landlord.email ? (
                <ActionLink href={`mailto:${tenancy.landlord.email}`} size="sm" icon="Envelope" intent="ghost">
                  Email
                </ActionLink>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>

      {paying && charges ? (
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
