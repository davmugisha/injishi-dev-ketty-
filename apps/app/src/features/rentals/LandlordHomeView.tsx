"use client";

import { Alert } from "@heroui/react";
import type { RentalsMoney, RentalsOverview, RentalsSetupView, RentalsSummary } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  CHART_COLOR,
  CountDonut,
  type DashboardPeriod,
  EmptyBlock,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  type KpiItem,
  KpiStrip,
  PageContent,
  PeriodMenu,
  type PeriodRange,
  periodRange,
  sumByBucket,
  TrendArea,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";

const UNITS = screenHref("Units");
const LEASES = screenHref("Leases");

/** The Tenants tile's line: who is moving in or out, else how many homes they live in. */
function tenantsLine(o: RentalsOverview, s: RentalsSummary | null): string {
  if (o.tenants === 0) return o.reservedUnits > 0 ? `${formatNumber(o.reservedUnits)} moving in` : "No tenants yet";
  const parts = [
    s && s.counts.readyToStart > 0 ? `${formatNumber(s.counts.readyToStart)} moving in` : null,
    s && s.counts.noticesToAcknowledge > 0 ? `${formatNumber(s.counts.noticesToAcknowledge)} moving out` : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return `In ${formatNumber(o.occupiedUnits)} ${o.occupiedUnits === 1 ? "unit" : "units"}`;
}

/** The period's money, from the day by day figures: what came in, what was due, what went out. */
function periodTotals(money: RentalsMoney | null, range: PeriodRange) {
  const inRange = (day: string) => day >= range.from && day <= range.to;
  const rent = (money?.charges ?? []).filter((c) => c.kind === "rent" && inRange(c.dueOn));
  return {
    collected: (money?.payments ?? []).filter((p) => inRange(p.day)).reduce((t, p) => t + p.amountRwf, 0),
    expected: rent.reduce((t, c) => t + c.amountRwf, 0),
    spent: (money?.spent ?? []).filter((e) => inRange(e.day)).reduce((t, e) => t + e.amountRwf, 0),
  };
}

function kpis(o: RentalsOverview, s: RentalsSummary | null, money: RentalsMoney | null, range: PeriodRange): KpiItem[] {
  const t = periodTotals(money, range);
  const rate = t.expected > 0 ? Math.min(100, Math.round((t.collected / t.expected) * 100)) : null;
  return [
    {
      id: "collected",
      label: "Collected",
      value: t.collected,
      icon: "Wallet",
      href: `${LEASES}?tab=active`,
      ...(rate !== null
        ? { ...(rate < 100 ? { progress: rate } : {}), footnote: `${formatMoney(t.expected)} rent fell due` }
        : { footnote: `In ${range.words}` }),
    },
    {
      id: "overdue",
      label: "Overdue now",
      value: o.overdue.amountRwf,
      icon: "TriangleExclamation",
      status: o.overdue.amountRwf > 0 ? "danger" : undefined,
      href: `${LEASES}?tab=active`,
      footnote:
        o.overdue.leases > 0
          ? `${formatNumber(o.overdue.leases)} ${o.overdue.leases === 1 ? "tenant" : "tenants"} late`
          : "Nobody is late",
    },
    {
      id: "spent",
      label: "Spent",
      value: t.spent,
      icon: "Receipt",
      href: screenHref("Expenses"),
      footnote: `Expenses in ${range.words}`,
    },
    {
      id: "occupancy",
      label: "Occupancy",
      value: o.occupancyPercent ?? 0,
      format: "percent",
      icon: "ChartLine",
      progress: o.occupancyPercent ?? 0,
      href: `${UNITS}?tab=occupied`,
      footnote:
        o.occupancyPercent === null
          ? "No units yet"
          : `${formatNumber(o.occupiedUnits)} of ${formatNumber(o.units)} units`,
    },
    {
      id: "tenants",
      label: "Tenants",
      value: o.tenants,
      format: "count",
      icon: "Persons",
      href: `${LEASES}?tab=active`,
      footnote: tenantsLine(o, s),
    },
  ];
}

/** The units by where they stand, for the ring: each slice opens that list. */
const UNIT_SLICES = [
  { key: "occupied", label: "Occupied", href: `${UNITS}?tab=occupied`, color: CHART_COLOR.cat(1) },
  { key: "reserved", label: "Signed, not moved in", href: `${LEASES}?tab=ready_to_start`, color: CHART_COLOR.cat(4) },
  { key: "vacant", label: "Vacant", href: `${UNITS}?tab=vacant`, color: CHART_COLOR.cat(5) },
  { key: "off_market", label: "Off market", href: `${UNITS}?tab=off_market`, color: "var(--chart-other)" },
] as const;

/**
 * The landlord's overview (2026-10-30): the period's figures (each opens the list it counts), money in
 * and out over the period, and the units by where they stand. Lists live in their own tabs (Calendar,
 * To do); setup shows as one line until it is done. Every figure is the API's.
 */
export function LandlordHomeView({
  firstName,
  businessName,
  today,
  overview,
  money,
  summary,
  setup,
  canLease,
  canAddUnits,
}: {
  firstName: string;
  businessName: string;
  today: string;
  overview: RentalsOverview | null;
  /** The money by the day, for the period filter and the chart. */
  money: RentalsMoney | null;
  summary: RentalsSummary | null;
  setup: RentalsSetupView | null;
  canLease: boolean;
  canAddUnits: boolean;
}) {
  const router = useRouter();
  const noUnits = overview ? overview.units === 0 : false;
  const setupOpen = setup !== null && !setup.complete;
  const addUnit = canAddUnits ? (
    <ActionLink href={`${UNITS}?add=1`} icon="Plus" size="sm">
      Add unit
    </ActionLink>
  ) : undefined;
  const [period, setPeriod] = useState<DashboardPeriod>("last_6");
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const series = useMemo(() => {
    const charges = (money?.charges ?? []).filter((c) => c.kind === "rent");
    return [
      sumByBucket(
        range,
        money?.payments ?? [],
        (p) => p.day,
        (p) => p.amountRwf,
      ),
      sumByBucket(
        range,
        charges,
        (c) => c.dueOn,
        (c) => c.amountRwf,
      ),
      sumByBucket(
        range,
        money?.spent ?? [],
        (e) => e.day,
        (e) => e.amountRwf,
      ),
    ];
  }, [money, range]);
  const units = overview
    ? [overview.occupiedUnits, overview.reservedUnits, overview.vacantUnits, overview.offMarketUnits]
    : [];
  return (
    <PageContent>
      <AreaHeader
        size="hello"
        eyebrow={
          <>
            {businessName} · {formatDay(today, "long")}
          </>
        }
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        actions={
          <>
            {money ? <PeriodMenu value={period} onChange={setPeriod} compact /> : null}
            {canLease ? (
              <ActionLink href={`${LEASES}/new`} icon="FileText" className="hidden sm:inline-flex">
                New lease
              </ActionLink>
            ) : null}
            {canAddUnits ? (
              <ActionLink href={`${UNITS}?add=1`} icon="Plus" intent="primary">
                Add unit
              </ActionLink>
            ) : null}
          </>
        }
      />

      {setupOpen && setup ? (
        <Alert status="accent" className="items-center">
          <Alert.Indicator>
            <Icon name="ListCheck" />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-1">
            <Alert.Title>
              Finish setting up: {formatNumber(setup.steps.filter((s) => s.done).length)} of{" "}
              {formatNumber(setup.steps.length)} done
            </Alert.Title>
          </Alert.Content>
          <ActionLink href={screenHref("RentalsSetup")} size="sm" intent="primary" className="shrink-0">
            Continue
          </ActionLink>
        </Alert>
      ) : null}

      {overview ? (
        <KpiStrip label={`Your homes in ${range.words}`} items={kpis(overview, summary, money, range)} />
      ) : (
        <EmptyBlock icon="Wallet" title="Money figures are restricted" />
      )}

      {money || overview ? (
        <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-5">
          {money ? (
            <TrendArea
              className="lg:col-span-3"
              title="Money in and out (RWF)"
              range={range}
              series={[
                { key: "collected", label: "Collected", color: CHART_COLOR.cat(1) },
                { key: "due", label: "Rent due", color: "var(--chart-other)", dashed: true },
                { key: "spent", label: "Spent", color: CHART_COLOR.cat(5) },
              ]}
              values={series}
              height={260}
              empty={{
                icon: "Wallet",
                title: `No money moved in ${range.words}`,
                action: noUnits ? addUnit : undefined,
              }}
            />
          ) : null}
          {overview ? (
            <CountDonut
              className={money ? "lg:col-span-2" : "lg:col-span-5"}
              title="Units"
              noun="units"
              totalLabel={`${formatNumber(overview.properties)} ${overview.properties === 1 ? "building" : "buildings"}`}
              data={UNIT_SLICES.map((u, i) => ({ key: u.key, label: u.label, count: units[i] ?? 0, color: u.color }))}
              onPick={(key) => {
                const slice = UNIT_SLICES.find((u) => u.key === key);
                if (slice) router.push(slice.href);
              }}
              empty={{ icon: "FolderHouse", title: "No units yet", action: addUnit }}
            />
          ) : null}
        </div>
      ) : null}
    </PageContent>
  );
}
