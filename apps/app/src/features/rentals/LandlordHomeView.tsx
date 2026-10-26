"use client";

import { Avatar, Card, Chip } from "@heroui/react";
import type {
  RentalsAttentionItem,
  RentalsAttentionKind,
  RentalsOverview,
  RentalsSetupView,
  RentalsSummary,
  RentalUnitView,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  CashFlowArea,
  CHART_COLOR,
  CollectedVsExpectedArea,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  type KpiItem,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  toneColor,
} from "@injishi/ui";
import NextLink from "next/link";
import { SetupChecklist } from "./SetupChecklist";
import { ATTENTION_HREF, ATTENTION_ICON } from "./shared";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const monthName = (key: string): string => MONTH.format(new Date(`${key}-15T12:00:00Z`));

const UNITS = screenHref("Units");
const LEASES = screenHref("Leases");

/** The verb on each "Needs attention" row: what pressing it does. */
const ATTENTION_VERB: Record<RentalsAttentionKind, string> = {
  setup_incomplete: "Continue",
  no_payout_account: "Add",
  overdue_rent: "See who",
  leases_to_sign: "Sign",
  ready_to_start: "Start",
  notices_to_acknowledge: "Review",
  filings_due: "File",
  waiting_for_tenant: "View",
};

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

function kpis(o: RentalsOverview, s: RentalsSummary | null): KpiItem[] {
  const last = o.months.at(-2);
  const now = o.months.at(-1);
  const change = o.rent.collectedChangePercent;
  const expected = o.rent.expectedThisMonthRwf;
  const rate = expected > 0 ? Math.min(100, Math.round((o.rent.collectedThisMonthRwf / expected) * 100)) : null;
  return [
    {
      id: "collected",
      label: "Collected",
      value: o.rent.collectedThisMonthRwf,
      icon: "Wallet",
      href: `${LEASES}?tab=active`,
      ...(rate !== null
        ? { progress: rate, footnote: `${rate}% of ${formatMoney(expected)}` }
        : { footnote: "No rent due" }),
      ...(change !== null && last ? { trend: { percent: change, versus: `vs ${monthName(last.month)}` } } : {}),
    },
    {
      id: "overdue",
      label: "Overdue",
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
      value: now?.spentRwf ?? 0,
      icon: "Receipt",
      href: screenHref("Expenses"),
      footnote: `Expenses in ${monthName(o.month)}`,
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

function NeedsAttention({ items }: { items: RentalsAttentionItem[] }) {
  return (
    <SectionCard
      title="Needs attention"
      actions={items.length > 0 ? <Chip size="sm">{formatNumber(items.length)}</Chip> : null}
      contentClassName="gap-0"
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <Icon name="CircleCheck" className="size-4 text-success" />
          Nothing needs you right now.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {items.map((item) => {
            const link = ATTENTION_HREF[item.kind];
            return (
              <li key={item.kind} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar size="sm" variant="soft" color={toneColor(item.tone)} className="shrink-0">
                  <Avatar.Fallback>
                    <Icon name={ATTENTION_ICON[item.kind]} />
                  </Avatar.Fallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-pretty">{item.title}</span>
                  {item.detail ? <span className="text-xs text-pretty text-muted">{item.detail}</span> : null}
                </span>
                {link ? (
                  <ActionLink href={link.href} size="sm" aria-label={link.label} className="shrink-0">
                    {ATTENTION_VERB[item.kind]}
                  </ActionLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** Where the units stand: one bar split by state, and each state's count as a link to that list. */
function UnitsCard({ o, vacant, canLease }: { o: RentalsOverview; vacant: RentalUnitView[]; canLease: boolean }) {
  const parts = [
    {
      id: "occupied",
      label: "Occupied",
      value: o.occupiedUnits,
      color: CHART_COLOR.cat(1),
      href: `${UNITS}?tab=occupied`,
    },
    {
      id: "reserved",
      label: "Signed, not moved in",
      value: o.reservedUnits,
      color: CHART_COLOR.cat(4),
      href: `${LEASES}?tab=ready_to_start`,
    },
    { id: "vacant", label: "Vacant", value: o.vacantUnits, color: CHART_COLOR.cat(5), href: `${UNITS}?tab=vacant` },
    {
      id: "off",
      label: "Off market",
      value: o.offMarketUnits,
      color: "var(--chart-other)",
      href: `${UNITS}?tab=off_market`,
    },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <SectionCard
      title="Units"
      contentClassName="flex-1"
      actions={
        <ActionLink href={UNITS} size="sm" intent="ghost" icon="ArrowRight">
          All units
        </ActionLink>
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted">No units yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular">{formatNumber(o.units)}</span>
            <span className="text-sm text-muted">
              in {formatNumber(o.properties)} {o.properties === 1 ? "building" : "buildings"}
            </span>
          </div>
          <div
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}
          >
            {parts
              .filter((p) => p.value > 0)
              .map((p) => (
                <span key={p.id} style={{ flexGrow: p.value, background: p.color }} className="h-full" />
              ))}
          </div>
          <ul className="flex flex-col">
            {parts.map((p) => (
              <li key={p.id}>
                <NextLink
                  href={p.href}
                  className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground no-underline hover:bg-default/60"
                >
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <span className="font-medium tabular">{formatNumber(p.value)}</span>
                </NextLink>
              </li>
            ))}
          </ul>
          {vacant.length > 0 ? (
            <div className="mt-auto flex flex-col gap-1 border-t border-separator pt-3">
              <span className="text-xs font-medium text-muted">Ready to let</span>
              <ul className="flex flex-col">
                {vacant.map((u) => (
                  <li key={u.id}>
                    <NextLink
                      href={canLease ? `${LEASES}/new?unit=${u.id}` : `${UNITS}?tab=vacant`}
                      className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground no-underline hover:bg-default/60"
                    >
                      <Icon name="FolderHouse" className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{u.label}</span>
                      {u.askingRentRwf !== null ? (
                        <span className="text-xs text-muted tabular">{formatMoney(u.askingRentRwf)}</span>
                      ) : null}
                      {canLease ? <Icon name="Plus" className="size-3.5 shrink-0 text-muted" /> : null}
                    </NextLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

/**
 * The landlord's home: the month's figures (each opens the list it counts), rent collected against
 * expected and the cash flow with a period switch, what needs attention as rows with their next step,
 * where the units stand, and the first-run checklist while setup is not done. Every figure is the API's.
 */
export function LandlordHomeView({
  firstName,
  businessName,
  today,
  overview,
  summary,
  setup,
  vacantUnits,
  canLease,
  canAddUnits,
}: {
  firstName: string;
  businessName: string;
  today: string;
  overview: RentalsOverview | null;
  summary: RentalsSummary | null;
  setup: RentalsSetupView | null;
  vacantUnits: RentalUnitView[];
  canLease: boolean;
  canAddUnits: boolean;
}) {
  const noUnits = overview ? overview.units === 0 : false;
  const setupOpen = setup !== null && !setup.complete;
  // While the checklist shows, setup and getting paid are on it: they are not listed twice.
  const attention = (summary?.attention ?? []).filter(
    (a) => !setupOpen || (a.kind !== "setup_incomplete" && a.kind !== "no_payout_account"),
  );
  const addUnit = canAddUnits ? (
    <ActionLink href={`${UNITS}?add=1`} icon="Plus" size="sm">
      Add unit
    </ActionLink>
  ) : undefined;
  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={
          <>
            {businessName} · {formatDay(today, "long")}
          </>
        }
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        actions={
          <>
            <ActionLink href={`${LEASES}/new`} icon="FileText">
              New lease
            </ActionLink>
            {canAddUnits ? (
              <ActionLink href={`${UNITS}?add=1`} icon="Plus" intent="primary">
                Add unit
              </ActionLink>
            ) : null}
          </>
        }
      />

      {overview ? (
        <KpiStrip label={`Your homes in ${monthName(overview.month)}`} items={kpis(overview, summary)} />
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted">The money figures are for people who look after the money here.</p>
        </Card>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        {overview ? (
          <CollectedVsExpectedArea
            className="lg:col-span-2"
            data={overview.months.map((m) => ({ month: m.month, expected: m.expectedRwf, collected: m.collectedRwf }))}
            emptyAction={noUnits ? addUnit : undefined}
          />
        ) : null}
        {/* On a phone, setup and what needs attention come before the charts. */}
        <div
          className={cx(
            "order-first flex min-w-0 flex-col gap-5 *:last:flex-1 lg:order-none",
            !overview && "lg:col-span-3",
          )}
        >
          {setupOpen ? <SetupChecklist setup={setup} /> : null}
          {summary ? <NeedsAttention items={attention} /> : null}
        </div>
      </div>

      {overview ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <CashFlowArea
            className="lg:col-span-2"
            data={overview.months.map((m) => ({ month: m.month, moneyIn: m.collectedRwf, moneyOut: m.spentRwf }))}
            emptyAction={noUnits ? addUnit : undefined}
          />
          <UnitsCard o={overview} vacant={vacantUnits} canLease={canLease} />
        </div>
      ) : null}
    </PageContent>
  );
}
