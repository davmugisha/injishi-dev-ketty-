"use client";

import { Chip } from "@heroui/react";
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
  EmptyBlock,
  formatDay,
  formatMoney,
  formatNumber,
  type KpiItem,
  KpiStrip,
  MoneyCalendar,
  type MoneyDay,
  PageContent,
  PageHeader,
  PeriodMenu,
  type PeriodRange,
  periodRange,
  SectionCard,
  sumByBucket,
  TrendArea,
} from "@injishi/ui";
import NextLink from "next/link";
import { useMemo, useState } from "react";

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

/** Arrivals and departures on the calendar: who comes, who leaves, by the day. */
function calendarDays(stays: readonly StayActivityItem[]): MoneyDay[] {
  const out: MoneyDay[] = [];
  for (const s of stays) {
    if (s.status === "cancelled" || s.status === "no_show") continue;
    const room = s.roomLabel ? ` · ${s.roomLabel}` : "";
    out.push({
      id: `in-${s.id}`,
      day: s.checkIn,
      title: `In ${s.guestName.split(/\s+/)[0]}`,
      detail: `${s.guestName} arrives${room} (${s.roomTypeName}), ${formatMoney(s.nightlyRwf)} a night`,
      tone: s.status === "requested" ? "info" : "due",
    });
    out.push({
      id: `out-${s.id}`,
      day: s.checkOut,
      title: `Out ${s.guestName.split(/\s+/)[0]}`,
      detail: `${s.guestName} leaves${room}`,
      tone: "paid",
    });
  }
  return out;
}

const CALENDAR_LEGEND: { tone: MoneyDay["tone"]; label: string; dot: string }[] = [
  { tone: "due", label: "Arriving", dot: "bg-accent" },
  { tone: "paid", label: "Leaving", dot: "bg-success" },
  { tone: "info", label: "Requested", dot: "bg-muted" },
];

const STATUS_WORDS: Record<
  StayActivityItem["status"],
  { label: string; color: "default" | "accent" | "success" | "warning" | "danger" }
> = {
  requested: { label: "Requested", color: "warning" },
  confirmed: { label: "Arriving", color: "accent" },
  in_house: { label: "In house", color: "success" },
  checked_out: { label: "Left", color: "default" },
  cancelled: { label: "Cancelled", color: "default" },
  no_show: { label: "No show", color: "danger" },
};

/**
 * A stay business's home (2026-10-29), the same layout as the landlord's: a period filter in the header,
 * the figures in one panel, the money received as an area and the calendar of arrivals and departures
 * beside it, occupancy over the period, and today's arrivals and departures with their next step. Every
 * figure is from the API; nothing is sample data.
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
  const days = useMemo(() => calendarDays(stays), [stays]);

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
      footnote: "Check them out at the desk",
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

  const todays = stays
    .filter(
      (s) =>
        (s.checkIn === today && (s.status === "confirmed" || s.status === "requested")) ||
        (s.status === "in_house" && s.checkOut <= today),
    )
    .slice(0, 6);

  return (
    <PageContent>
      <PageHeader
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
            <ActionLink href={screenHref("Reservations")} icon="Calendar">
              Bookings
            </ActionLink>
            <ActionLink href={screenHref("WalkIn")} icon="PersonPlus" intent="primary">
              Walk in
            </ActionLink>
          </>
        }
      />

      {setup ? (
        <SectionCard
          title={setup.notApproved ? "Waiting for approval" : "Finish setting up"}
          actions={
            <ActionLink href={setup.href} size="sm" icon="ArrowRight">
              {setup.notApproved ? "See where it is" : "Continue"}
            </ActionLink>
          }
        >
          <p className="text-sm text-muted">
            {setup.notApproved
              ? "Your business is being checked. You can prepare your rooms and prices meanwhile."
              : "Add your rooms, prices and photos, then publish so guests can book."}
          </p>
        </SectionCard>
      ) : null}

      <KpiStrip label={`${summary.business.orgName} in ${range.words}`} items={kpis} />

      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <TrendArea
          className="lg:col-span-3"
          title="Money received"
          description={`Payments on guests' bills, less refunds, in ${range.words}`}
          range={range}
          series={[{ key: "received", label: "Received", color: CHART_COLOR.cat(1) }]}
          values={money}
          height={210}
          empty={{ icon: "Wallet", title: `Nothing received in ${range.words}` }}
        />
        <SectionCard title="Arrivals and departures" className="lg:col-span-2" contentClassName="min-h-0 flex-1">
          <MoneyCalendar
            days={days}
            today={today}
            label="Arrivals and departures"
            legend={CALENDAR_LEGEND}
            className="h-[290px]"
          />
        </SectionCard>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <TrendArea
          className="lg:col-span-3"
          title="Occupancy"
          description={`Nights sold over the ${words.many} there were to sell, in ${range.words}`}
          range={range}
          format="percent"
          series={[{ key: "occupancy", label: "Occupied", color: CHART_COLOR.cat(2) }]}
          values={occ}
          height={190}
          empty={{ icon: "House", title: `No nights sold in ${range.words}` }}
        />
        <SectionCard
          title="Today"
          className="lg:col-span-2"
          actions={
            <ActionLink href={screenHref("FrontDeskToday")} size="sm" intent="ghost" icon="ArrowRight">
              Front desk
            </ActionLink>
          }
        >
          {todays.length === 0 ? (
            <EmptyBlock size="sm" icon="CircleCheck" title="Nobody arrives or leaves today" />
          ) : (
            <ul className="flex flex-col divide-y divide-separator">
              {todays.map((s) => {
                const st = STATUS_WORDS[s.status];
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{s.guestName}</span>
                      <span className="truncate text-xs text-muted">
                        {s.roomLabel ?? s.roomTypeName} · {formatDay(s.checkIn, "short")} to{" "}
                        {formatDay(s.checkOut, "short")}
                      </span>
                    </span>
                    <Chip size="sm" variant="soft" color={st.color}>
                      {s.status === "in_house" ? "Leaving" : st.label}
                    </Chip>
                    <NextLink
                      href={screenHref(s.status === "in_house" ? "Checkout" : "Reservations")}
                      className="text-xs font-medium text-accent no-underline hover:underline"
                    >
                      {s.status === "in_house" ? "Check out" : "Open"}
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </PageContent>
  );
}
