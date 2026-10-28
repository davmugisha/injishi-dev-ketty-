"use client";

import { Alert, Card, Toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import {
  daysBetween,
  type LeaseChargeView,
  type TenancyDetail,
  type TenantChargeList,
  type TenantPaymentView,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  CHART_COLOR,
  type DashboardPeriod,
  DateText,
  EmptyBlock,
  formatDay,
  formatLocalPhone,
  formatMoney,
  Icon,
  KeyValueList,
  Money,
  MoneyCalendar,
  type MoneyDay,
  PageContent,
  PageHeader,
  PeriodMenu,
  PersonCell,
  periodRange,
  SectionCard,
  StatusChip,
  sumByBucket,
  TrendArea,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { dueDayWords, placeWords, tenantGuestsHref, tenantLeaseHref, tenantRentHref } from "../leases/shared";
import { HomeCoverImage } from "../rentals/home-cover";
import { nextRent } from "./format";
import { PayPanel } from "./PayPanel";
import { RateBrokerDialog } from "./TenantBrokerCard";

/** What is owed now, in one sentence and a tone. */
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The tenant's payments calendar (2026-10-28): every charge still to pay on its due day, every payment
 * on the day it arrived, and the rent days ahead the landlord has not raised a charge for yet, until the
 * lease ends, so the next months can be planned.
 */
function tenantCalendar(
  charges: LeaseChargeView[],
  payments: TenantPaymentView[],
  terms: { monthlyRentRwf: number; rentDueDay: number; endDate: string },
  today: string,
): MoneyDay[] {
  const short = (n: number) => formatMoney(n, { compact: true });
  const out: MoneyDay[] = [];
  for (const c of charges) {
    if (c.status === "waived") continue;
    if (c.status === "paid") continue;
    out.push({
      id: `c-${c.id}`,
      day: c.dueOn,
      title: `${c.kind === "deposit" ? "Deposit" : "Rent"} ${short(c.outstandingRwf)}`,
      detail: `${c.label}: ${formatMoney(c.outstandingRwf)} ${c.overdue ? "overdue" : "to pay"}`,
      tone: c.overdue ? "overdue" : "due",
    });
  }
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const day = p.paidOn ?? p.succeededAt?.slice(0, 10) ?? p.createdAt.slice(0, 10);
    out.push({
      id: `p-${p.id}`,
      day,
      title: `Paid ${short(p.amountRwf)}`,
      detail: `You paid ${formatMoney(p.amountRwf)}`,
      tone: "paid",
    });
  }
  const months = new Set(charges.filter((c) => c.kind === "rent").map((c) => c.dueOn.slice(0, 7)));
  const [y, m] = today.split("-").map(Number) as [number, number];
  for (let i = 0; i < 6; i++) {
    const index = y * 12 + (m - 1) + i;
    const key = `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
    const last = new Date(Date.UTC(Math.floor(index / 12), (index % 12) + 1, 0)).getUTCDate();
    const day = `${key}-${pad2(Math.min(terms.rentDueDay, last))}`;
    if (months.has(key) || day < today || day > terms.endDate) continue;
    out.push({
      id: `r-${key}`,
      day,
      title: `Rent ${short(terms.monthlyRentRwf)}`,
      detail: `Rent of ${formatMoney(terms.monthlyRentRwf)} falls due`,
      tone: "info",
    });
  }
  return out;
}

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
  const [period, setPeriod] = useState<DashboardPeriod>("last_6");
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const paidSeries = useMemo(() => {
    const ok = payments.filter((p) => p.status === "succeeded");
    const dueRent = (charges?.charges ?? []).filter((c) => c.status !== "waived");
    return [
      sumByBucket(
        range,
        ok,
        (p) => p.paidOn ?? p.succeededAt?.slice(0, 10) ?? p.createdAt.slice(0, 10),
        (p) => p.amountRwf,
      ),
      sumByBucket(
        range,
        dueRent,
        (c) => c.dueOn,
        (c) => c.amountRwf,
      ),
    ];
  }, [payments, charges, range]);
  const calendar = useMemo(
    () => tenantCalendar(charges?.charges ?? [], payments, tenancy.terms, today),
    [charges, payments, tenancy.terms, today],
  );
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

        <SectionCard title="Payments calendar" className="h-full" contentClassName="min-h-0 flex-1">
          <MoneyCalendar days={calendar} today={today} className="h-[300px]" label="Your payments calendar" />
        </SectionCard>

        <TrendArea
          className="lg:col-span-2"
          title="Your payments"
          description={`What you paid against what fell due, in ${range.words}`}
          range={range}
          actions={<PeriodMenu value={period} onChange={setPeriod} />}
          series={[
            { key: "paid", label: "Paid", color: CHART_COLOR.cat(1) },
            { key: "due", label: "Due", color: "var(--chart-other)", dashed: true },
          ]}
          values={paidSeries}
          height={200}
          empty={{ icon: "Receipt", title: `Nothing paid or due in ${range.words}` }}
        />

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
