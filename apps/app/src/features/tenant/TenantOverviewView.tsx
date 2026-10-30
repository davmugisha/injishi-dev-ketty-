"use client";

import { Toast } from "@heroui/react";
import { daysBetween, type TenancyDetail, type TenantChargeList, type TenantPaymentView } from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  CHART_COLOR,
  type DashboardPeriod,
  formatDay,
  formatLocalPhone,
  formatMoney,
  KpiStrip,
  PageContent,
  PeriodMenu,
  PersonCell,
  periodRange,
  SectionCard,
  sumByBucket,
  TrendArea,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { placeWords, tenantLeaseHref, tenantRentHref } from "../leases/shared";
import { nextRent } from "./format";
import { PayPanel } from "./PayPanel";

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

const paidOn = (p: TenantPaymentView) => p.paidOn ?? p.succeededAt?.slice(0, 10) ?? p.createdAt.slice(0, 10);

/** The lease's status in a few words, only when it is not simply running. */
function statusLine(tenancy: TenancyDetail): string | null {
  if (tenancy.status === "pending_signature")
    return tenancy.needsMySignature ? "Waiting for your signature" : "Waiting for your landlord";
  if (tenancy.status === "signed") return `Starts ${formatDay(tenancy.terms.startDate, "long")}`;
  if (tenancy.status === "cancelled") return "Cancelled";
  if (tenancy.status === "ended") return "Ended";
  return null;
}

/**
 * The tenant's overview (2026-10-30): what is owed now with Pay, the next rent, the lease's end, payments
 * against what fell due over a period, and the landlord to reach. Lists live on their own tabs.
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
  const [period, setPeriod] = useState<DashboardPeriod>("last_6");
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const paid = useMemo(() => payments.filter((p) => p.status === "succeeded"), [payments]);
  const series = useMemo(
    () => [
      sumByBucket(range, paid, paidOn, (p) => p.amountRwf),
      sumByBucket(
        range,
        (charges?.charges ?? []).filter((c) => c.status !== "waived"),
        (c) => c.dueOn,
        (c) => c.amountRwf,
      ),
    ],
    [paid, charges, range],
  );
  const owedNow = charges ? charges.outstandingRwf : tenancy.charges.balanceRwf;
  const landlord = tenancy.landlord;
  const rentHref = tenantRentHref(tenancy.id);

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader
        size="hello"
        eyebrow={placeWords(tenancy)}
        title={firstName ? `Hello, ${firstName}` : "Your home"}
        description={statusLine(tenancy)}
        actions={
          <>
            <PeriodMenu value={period} onChange={setPeriod} />
            {tenancy.needsMySignature ? (
              <ActionLink href={`${tenantLeaseHref(tenancy.id)}?sign=1`} icon="PencilToSquare" intent="primary">
                Review and sign
              </ActionLink>
            ) : canPay || charges?.pendingPaymentId ? (
              <ActionButton icon="Wallet" intent="primary" onPress={() => setPaying(true)}>
                {charges?.pendingPaymentId ? "Payment waiting" : "Pay now"}
              </ActionButton>
            ) : null}
          </>
        }
      />

      <KpiStrip
        label="Your home at a glance"
        items={[
          {
            id: "owed",
            label: "Owed now",
            value: owedNow,
            icon: "Receipt",
            status: owed?.tone === "danger" ? "danger" : owed?.tone === "warning" ? "warning" : undefined,
            footnote:
              charges && charges.creditRwf > 0
                ? `${formatMoney(charges.creditRwf)} credit`
                : (owed?.title ?? undefined),
            href: `${rentHref}/charges`,
          },
          {
            id: "next",
            label: "Next rent",
            value: upcoming?.amountRwf ?? 0,
            icon: "Calendar",
            footnote: upcoming ? formatDay(upcoming.dueOn, "long") : "No month left",
            href: `/home/${tenancy.id}/calendar`,
          },
          {
            id: "paid",
            label: "Paid so far",
            value: paid.reduce((n, p) => n + p.amountRwf, 0),
            icon: "CircleCheck",
            footnote: `${paid.length} ${paid.length === 1 ? "payment" : "payments"}`,
            href: rentHref,
          },
          {
            id: "ends",
            label: "Days left",
            value: Math.max(0, left),
            format: "count",
            icon: "FileText",
            footnote: `Lease ends ${formatDay(t.endDate)}`,
            href: tenantLeaseHref(tenancy.id),
          },
        ]}
      />

      <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-3">
        <TrendArea
          className="lg:col-span-2"
          title="Paid and due (RWF)"
          range={range}
          series={[
            { key: "paid", label: "Paid", color: CHART_COLOR.cat(1) },
            { key: "due", label: "Due", color: "var(--chart-other)", dashed: true },
          ]}
          values={series}
          height={240}
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
      </div>

      {paying && charges ? (
        <PayPanel
          leaseId={tenancy.id}
          charges={charges}
          phone={tenancy.tenant.phone}
          waitingId={charges.pendingPaymentId}
          only={null}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </PageContent>
  );
}
