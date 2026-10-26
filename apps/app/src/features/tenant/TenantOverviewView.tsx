"use client";

import { Alert, Card, Toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import {
  daysBetween,
  LEASE_PAYMENT_METHOD_LABEL,
  type LeaseChargeView,
  type TenancyDetail,
  type TenantChargeList,
  type TenantPaymentView,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DateText,
  EmptyBlock,
  formatDay,
  formatLocalPhone,
  formatMoney,
  Icon,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  PersonCell,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { dueDayWords, placeWords, tenantGuestsHref, tenantLeaseHref, tenantRentHref } from "../leases/shared";
import { HomeCoverImage } from "../rentals/home-cover";
import { nextRent } from "./format";
import { PayPanel } from "./PayPanel";
import { RateBrokerDialog } from "./TenantBrokerCard";

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
  const upcoming = charges ? nextRent(t, charges.charges, today) : null;
  const [rating, setRating] = useState(false);
  const todo: {
    id: string;
    title: string;
    detail: string;
    href?: string;
    press?: () => void;
    icon: "FileText" | "Wallet" | "PersonPlus" | "Star";
  }[] = [];
  if (tenancy.needsMySignature)
    todo.push({
      id: "sign",
      title: "Sign your lease",
      detail: `${tenancy.landlord.name} signed it.`,
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
  if (tenancy.broker?.canRate && !tenancy.broker.rating)
    todo.push({
      id: "rate",
      title: "Rate your broker",
      detail: tenancy.broker.name ?? "The broker who found you this home",
      press: () => setRating(true),
      icon: "Star",
    });
  if (tenancy.status === "active" || tenancy.status === "signed")
    todo.push({
      id: "guests",
      title: "Register an overnight guest",
      detail: "Shared with the local leaders only",
      href: tenantGuestsHref(tenancy.id),
      icon: "PersonPlus",
    });

  const owedNow = charges ? charges.outstandingRwf : tenancy.charges.balanceRwf;
  const landlord = tenancy.landlord;

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
              ? `Your tenancy starts ${formatDay(t.startDate, "long")}.`
              : tenancy.status === "cancelled"
                ? "This lease was cancelled."
                : tenancy.status === "ended"
                  ? "This lease has ended."
                  : null
        }
        actions={
          tenancy.needsMySignature ? (
            <ActionLink href={`${tenantLeaseHref(tenancy.id)}?sign=1`} icon="PencilToSquare" intent="primary">
              Review and sign
            </ActionLink>
          ) : null
        }
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <Card className="min-w-0 gap-0 overflow-hidden p-0 shadow-surface lg:col-span-2">
          <HomeCoverImage
            seed={tenancy.id}
            photos={tenancy.coverPhotoUrl ? [tenancy.coverPhotoUrl] : []}
            className="aspect-[2.4/1] max-h-36 w-full sm:max-h-40"
          />
          <div className="grid h-full min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
            <div className="flex min-w-0 flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted">What you owe now</span>
                {owed && owed.tone !== "success" ? (
                  <StatusChip tone={owed.tone}>{owed.tone === "danger" ? "Overdue" : "Due"}</StatusChip>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular">{formatMoney(owedNow)}</span>
                {owed ? (
                  <span className={owed.tone === "danger" ? "text-sm text-danger" : "text-sm text-muted"}>
                    {owed.title}
                  </span>
                ) : null}
                {charges && charges.creditRwf > 0 ? (
                  <span className="text-sm text-muted">{formatMoney(charges.creditRwf)} credit on your next rent</span>
                ) : null}
              </div>
              {charges?.pendingPaymentId ? (
                <Alert status="accent">
                  <Alert.Indicator>
                    <Icon name="Smartphone" />
                  </Alert.Indicator>
                  <Alert.Content className="gap-2">
                    <Alert.Title className="text-sm">A payment is waiting for you on your phone.</Alert.Title>
                    <ActionButton size="sm" className="self-start" onPress={() => pay()}>
                      See where it is
                    </ActionButton>
                  </Alert.Content>
                </Alert>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                {canPay ? (
                  <ActionButton icon="Wallet" intent="primary" onPress={() => pay()}>
                    Pay now
                  </ActionButton>
                ) : null}
                <ActionLink href={tenantRentHref(tenancy.id)} icon="Receipt" intent="ghost">
                  Payments and receipts
                </ActionLink>
              </div>
            </div>
            <dl className="grid min-w-0 grid-cols-2 content-center gap-4 border-t border-separator p-5 sm:grid-cols-1 sm:border-t-0 sm:border-l">
              <Fact
                label="Next rent"
                value={upcoming ? <Money value={upcoming.amountRwf} /> : "None left"}
                hint={upcoming ? formatDay(upcoming.dueOn, "long") : undefined}
              />
              <Fact
                label="Lease ends"
                value={<DateText value={t.endDate} />}
                hint={live && left >= 0 ? `${left} ${left === 1 ? "day" : "days"} left` : undefined}
              />
            </dl>
          </div>
        </Card>

        <SectionCard title="Your landlord" className="h-full" contentClassName="flex-1">
          <PersonCell
            size="md"
            name={landlord.name}
            secondary={landlord.signatoryName ?? (landlord.phone ? formatLocalPhone(landlord.phone) : undefined)}
          />
          {landlord.phone && landlord.signatoryName ? (
            <span className="text-sm text-muted tabular">{formatLocalPhone(landlord.phone)}</span>
          ) : null}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <ActionLink href={`/home/${tenancy.id}/messages`} icon="Comments" className="w-full">
              Message
            </ActionLink>
            {landlord.phone ? (
              <ActionLink href={`tel:${landlord.phone}`} icon="Handset" className="w-full">
                Call
              </ActionLink>
            ) : landlord.email ? (
              <ActionLink href={`mailto:${landlord.email}`} icon="Envelope" className="w-full">
                Email
              </ActionLink>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="To do" className="h-full lg:col-span-2" contentClassName="gap-0">
          {todo.length === 0 ? (
            <EmptyBlock size="sm" icon="CircleCheck" title="You are all caught up" />
          ) : (
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
                <ListView.Item id={item.id} textValue={item.title} className="cursor-pointer">
                  <ListView.ItemContent className="items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
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
          )}
        </SectionCard>

        <SectionCard
          title="Your lease"
          className="h-full"
          actions={
            <ActionLink href={tenantLeaseHref(tenancy.id)} size="sm" intent="ghost" icon="FileText">
              Read
            </ActionLink>
          }
        >
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
              { label: "Started", value: <DateText value={t.startDate} /> },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Latest payments"
          className="lg:col-span-3"
          actions={
            payments.length > 0 ? (
              <ActionLink href={tenantRentHref(tenancy.id)} size="sm" intent="ghost" icon="ArrowRight">
                All payments
              </ActionLink>
            ) : null
          }
        >
          {payments.length === 0 ? (
            <EmptyBlock
              size="sm"
              icon="Receipt"
              title="No payments yet"
              description={canPay ? "When you pay rent or a deposit, it will show here." : undefined}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-separator">
              {payments.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{LEASE_PAYMENT_METHOD_LABEL[p.method]}</span>
                    <span className="truncate text-xs text-muted">
                      {formatDay(p.paidOn ?? p.createdAt)}
                      {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-0">
                    <Money value={p.amountRwf} className="font-medium sm:inline-block sm:w-36 sm:text-right" />
                    <span className="flex sm:w-24 sm:justify-end">
                      <StatusChip kind="payment" status={p.status} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
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
      {tenancy.broker ? <RateBrokerDialog tenancy={tenancy} isOpen={rating} onOpenChange={setRating} /> : null}
    </PageContent>
  );
}

function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-base font-semibold tabular">{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
