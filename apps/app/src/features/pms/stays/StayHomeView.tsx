"use client";

import { Alert } from "@heroui/react";
import {
  type BusinessKind,
  nightsSold,
  type StayActivityItem,
  type StaysActivity,
  type StaysSummary,
  stayUnitWords,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  CHART_COLOR,
  type DashboardPeriod,
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
import { useMemo, useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";

const KIND_WORDS: Partial<Record<BusinessKind, string>> = {
  guest_house: "Guest house",
  lodge: "Lodge",
  hotel: "Hotel",
  motel: "Motel",
  apartment: "Serviced apartments",
  villa: "Villa",
  tented_camp: "Tented camp",
};

/** Every day of a period, for counting nights. */
function daysOf(range: PeriodRange): string[] {
  const out: string[] = [];
  const end = Date.parse(`${range.to}T12:00:00Z`);
  for (let t = Date.parse(`${range.from}T12:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Occupancy per bucket: nights sold over the nights there were to sell, in percent. */
function occupancy(range: PeriodRange, stays: readonly StayActivityItem[], rooms: number): number[] {
  const days = daysOf(range);
  const sold = nightsSold(stays, days);
  return range.buckets.map((b) => {
    let nights = 0;
    let count = 0;
    days.forEach((d, i) => {
      if (d >= b.from && d <= b.to) {
        nights += sold[i] ?? 0;
        count += 1;
      }
    });
    return rooms > 0 && count > 0 ? Math.round((nights / (rooms * count)) * 1000) / 10 : 0;
  });
}

/**
 * A stay business's overview (2026-10-30), the same layout as the landlord's: a period filter in the
 * header, the figures in one panel, then money received and occupancy over the period. Today's guests and
 * the calendar are their own tabs. Every figure is from the API; nothing is sample data.
 */
export function StayHomeView({
  firstName,
  summary,
  activity,
  setup,
}: {
  firstName: string;
  summary: StaysSummary;
  activity: StaysActivity | null;
  /** Shown while the business is not on the marketplace yet. */
  setup: { href: string; notApproved: boolean } | null;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const today = summary.today;
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const words = stayUnitWords(summary.business.kind);
  const stays = activity?.stays ?? [];
  const rooms = summary.business.rooms;

  const money = useMemo(
    () => [
      sumByBucket(
        range,
        activity?.payments ?? [],
        (p) => p.day,
        (p) => p.amountRwf,
      ),
    ],
    [range, activity],
  );
  const occ = useMemo(() => [occupancy(range, stays, rooms)], [range, stays, rooms]);

  const inPeriod = stays.filter((s) => s.checkIn <= range.to && s.checkOut > range.from);
  const sold = nightsSold(stays, daysOf(range)).reduce((a, n) => a + n, 0);
  const received = money[0]?.reduce((a, n) => a + n, 0) ?? 0;
  const nightlyAverage = (() => {
    const live = inPeriod.filter((s) => s.status !== "cancelled" && s.status !== "no_show" && s.nightlyRwf > 0);
    return live.length > 0 ? Math.round(live.reduce((a, s) => a + s.nightlyRwf, 0) / live.length) : 0;
  })();
  const tonight = rooms > 0 ? Math.round((summary.counts.inHouse / rooms) * 1000) / 10 : 0;

  const kpis: KpiItem[] = [
    {
      id: "tonight",
      label: "Occupied tonight",
      value: tonight,
      format: "percent",
      icon: "House",
      progress: tonight,
      footnote: `${formatNumber(summary.counts.inHouse)} of ${formatNumber(rooms)} ${rooms === 1 ? words.one : words.many}`,
    },
    {
      id: "arrivals",
      label: "Arriving today",
      value: summary.counts.arrivalsToday,
      format: "count",
      icon: "ArrowRightToSquare",
      href: screenHref("FrontDeskToday"),
      footnote:
        summary.counts.requestsWaiting > 0
          ? `${formatNumber(summary.counts.requestsWaiting)} requests to answer`
          : "No requests waiting",
      status: summary.counts.requestsWaiting > 0 ? "warning" : undefined,
    },
    {
      id: "departures",
      label: "Leaving today",
      value: summary.counts.departuresToday,
      format: "count",
      icon: "ArrowRightFromSquare",
      href: screenHref("FrontDeskToday"),
    },
    {
      id: "received",
      label: "Received",
      value: received,
      icon: "Wallet",
      footnote: `On guests' bills, ${range.words}`,
    },
    {
      id: "nights",
      label: "Nights sold",
      value: sold,
      format: "count",
      icon: "Calendar",
      footnote: nightlyAverage > 0 ? `${formatMoney(nightlyAverage)} a night on average` : `In ${range.words}`,
    },
  ];

  return (
    <PageContent>
      <AreaHeader
        size="hello"
        eyebrow={
          <>
            {summary.business.propertyName ?? summary.business.orgName} · {KIND_WORDS[summary.business.kind] ?? "Stays"}{" "}
            · {formatDay(today, "long")}
          </>
        }
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        actions={
          <>
            <PeriodMenu value={period} onChange={setPeriod} />
            <ActionLink href={screenHref("WalkIn")} icon="PersonPlus" intent="primary">
              Walk in
            </ActionLink>
          </>
        }
      />

      {setup ? (
        <Alert status={setup.notApproved ? "default" : "accent"} className="items-center">
          <Alert.Indicator>
            <Icon name={setup.notApproved ? "Hourglass" : "ListCheck"} />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-1">
            <Alert.Title>
              {setup.notApproved ? "Waiting for approval" : "Finish setting up to take bookings"}
            </Alert.Title>
          </Alert.Content>
          <ActionLink
            href={setup.href}
            size="sm"
            intent={setup.notApproved ? "secondary" : "primary"}
            className="shrink-0"
          >
            {setup.notApproved ? "See where it is" : "Continue"}
          </ActionLink>
        </Alert>
      ) : null}

      <KpiStrip label={`${summary.business.orgName} in ${range.words}`} items={kpis} />

      <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-2">
        <TrendArea
          title="Money received (RWF)"
          range={range}
          series={[{ key: "received", label: "Received", color: CHART_COLOR.cat(1) }]}
          values={money}
          height={240}
          empty={{ icon: "Wallet", title: `Nothing received in ${range.words}` }}
        />
        <TrendArea
          title="Occupancy (%)"
          range={range}
          format="percent"
          series={[{ key: "occupancy", label: "Occupied", color: CHART_COLOR.cat(2) }]}
          values={occ}
          height={240}
          empty={{ icon: "House", title: `No nights sold in ${range.words}` }}
        />
      </div>
    </PageContent>
  );
}
