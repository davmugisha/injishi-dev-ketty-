"use client";

import { AreaChart } from "@heroui-pro/react/area-chart";
import { BarChart } from "@heroui-pro/react/bar-chart";
import {
  ActionButton,
  ActionLink,
  CHART_COLOR,
  ChartCard,
  CountDonut,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  formatMoneyAxis,
  formatNumber,
  type KpiItem,
  KpiStrip,
  PageContent,
  PageHeader,
  PeriodPicker,
  periodFromRange,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { psfFeeTotal } from "@injishi/contracts";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportTable } from "@/lib/table-export";
import type { PsfReport, PsfScope } from "@/server/sources/psf";

import { FeeStrip, FeeViewSwitch, useFeeAmount, useFeeView } from "./psf-fee-view";
import { PSF_REPORTS, type PsfReportId } from "./psf-reports";

export { PSF_REPORTS, type PsfReportId };


const reportHref = (id: PsfReportId) => `/psf/report/${id}`;
const businessHref = (orgId: string) => `/psf/register/${orgId}`;

/** "2026-10" → "Oct", or "Oct 2026" in full. */
function monthLabel(month: string, full = false): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** A KPI's change against the period before, for the strip's trend line. */
function trend(kpi: { value: number; previous: number }, goodWhen: "up" | "down" = "up"): KpiItem["trend"] {
  if (kpi.previous === 0) return undefined;
  return {
    percent: Math.round(((kpi.value - kpi.previous) / kpi.previous) * 100),
    goodWhen,
    versus: "the period before",
  };
}

const days = (n: number | null) =>
  n === null ? "—" : n < 1 ? "Under a day" : `${formatNumber(Math.round(n))} ${Math.round(n) === 1 ? "day" : "days"}`;

/** A median wait as a KPI: in hours under a day (0.1 of a day reads as nothing), else in days. */
function waitKpi(id: string, n: number | null, from: string): KpiItem {
  if (n === null)
    return { id, label: "Time to decide", value: 0, format: "count", icon: "Clock", footnote: "Nothing decided yet" };
  const hours = n < 1;
  return {
    id,
    label: "Time to decide",
    value: hours ? Math.max(1, Math.round(n * 24)) : Math.round(n * 10) / 10,
    format: "count",
    icon: "Clock",
    footnote: `${hours ? "Median hours" : "Median days"}, ${from}`,
  };
}

/** The months as the bar charts read them: counts, without the fees' breakdown. */
const barMonths = (r: PsfReport) => r.months.map(({ fees: _fees, ...m }) => m);

/** Members by tier, with the members whose membership names no tier (declared, not applied for). */
function tierSlices(r: PsfReport) {
  const slices = r.byFamily.map((f) => ({ key: f.key, label: f.label, count: f.count }));
  const untiered = r.now.members - slices.reduce((n, f) => n + f.count, 0);
  return untiered > 0 ? [...slices, { key: "none", label: "No tier", count: untiered }] : slices;
}

// ── Export and print ──────────────────────────────────────────────────────────────────────────────

interface CsvSection {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

function csvFor(id: PsfReportId, r: PsfReport): CsvSection[] {
  const months: CsvSection = {
    title: "Month by month",
    columns: ["Month", "Registered", "Applied", "Approved", "New members", "New membership fees (RWF)", "Renewals (RWF)", "Upgrades (RWF)", "All fees (RWF)", "Districts' share (RWF)", "Headquarters' share (RWF)"],
    rows: r.months.map((m) => {
      const t = psfFeeTotal(m.fees);
      return [monthLabel(m.month, true), m.registered, m.applied, m.approved, m.members, m.fees.application.totalRwf, m.fees.renewal.totalRwf, m.fees.upgrade.totalRwf, t.totalRwf, t.districtRwf, t.headquartersRwf];
    }),
  };
  const k = r.kpis;
  switch (id) {
    case "membership":
      return [
        {
          title: "Headline",
          columns: ["Figure", "This period", "Period before"],
          rows: [
            ["Applied", k.applied.value, k.applied.previous],
            ["Approved", k.approved.value, k.approved.previous],
            ["Sent back", k.declined.value, k.declined.previous],
            ["New members", k.newMembers.value, k.newMembers.previous],
            ["Renewed", k.renewed.value, k.renewed.previous],
            ["Upgraded", k.upgraded.value, k.upgraded.previous],
            ["Card holders brought in", k.cardHolders.value, k.cardHolders.previous],
            ["New membership fees (RWF)", r.fees.current.application.totalRwf, r.fees.previous.application.totalRwf],
            ["Renewals (RWF)", r.fees.current.renewal.totalRwf, r.fees.previous.renewal.totalRwf],
            ["Upgrades (RWF)", r.fees.current.upgrade.totalRwf, r.fees.previous.upgrade.totalRwf],
            ["All fees (RWF)", k.membershipFeesRwf.value, k.membershipFeesRwf.previous],
            ["Districts' share (RWF)", psfFeeTotal(r.fees.current).districtRwf, psfFeeTotal(r.fees.previous).districtRwf],
            ["Headquarters' share (RWF)", psfFeeTotal(r.fees.current).headquartersRwf, psfFeeTotal(r.fees.previous).headquartersRwf],
            ["Median days to decide", k.medianDecisionDays.value ?? "", k.medianDecisionDays.previous ?? ""],
          ],
        },
        months,
        {
          title: "Members by tier",
          columns: ["Tier", "Members", "Yearly fees (RWF)"],
          rows: r.byFamily.map((f) => [f.label, f.count, f.amountRwf]),
        },
        { title: "By owner group", columns: ["Group", "Businesses"], rows: r.byGroup.map((g) => [g.label, g.count]) },
        {
          title: "By PSF sector",
          columns: ["Sector", "Businesses", "All fees (RWF)", "Districts' share (RWF)", "Headquarters' share (RWF)"],
          rows: r.bySector.map((s) => [s.label, s.count, s.amountRwf, s.districtRwf, s.headquartersRwf]),
        },
      ];
    case "approvals": {
      const g = r.registrations;
      return [
        {
          title: "Where registrations stand",
          columns: ["Stage", "Businesses"],
          rows: [
            ["Waiting for review", g.waitingReview],
            ["Waiting for a second officer", g.waitingApproval],
            ["Approved and open", g.active],
            ["Rejected", g.rejected],
            ["Suspended", g.suspended],
            ["Fee not paid yet", g.waitingPayment],
          ],
        },
        {
          title: "Decisions in the period",
          columns: ["Figure", "This period", "Period before"],
          rows: [
            ["Approved", g.approvedInPeriod.value, g.approvedInPeriod.previous],
            ["Rejected", g.rejectedInPeriod.value, g.rejectedInPeriod.previous],
            ["Median days to decide", g.medianDaysToDecision ?? "", ""],
          ],
        },
        {
          title: "Month by month",
          columns: ["Month", "Fees paid", "Approved", "Rejected"],
          rows: g.months.map((m) => [monthLabel(m.month, true), m.submitted, m.approved, m.rejected]),
        },
        {
          title: "Businesses decided",
          columns: ["Business", "Kind", "Decision", "Decided by", "Date"],
          rows: g.decided.map((d) => [d.legalName, d.kindLabel, d.decision, d.decidedBy ?? "", formatDay(d.decidedAt)]),
        },
      ];
    }
    case "economy": {
      const e = r.economy;
      return [
        {
          title: "Headline",
          columns: ["Figure", "This period", "Period before"],
          rows: [
            ["Bookings arriving", e.bookings.value, e.bookings.previous],
            ["Guest nights", e.guestNights.value, e.guestNights.previous],
            ["Booked value (RWF)", e.bookedValueRwf.value, e.bookedValueRwf.previous],
          ],
        },
        {
          title: "Month by month",
          columns: ["Month", "Bookings", "Guest nights", "Booked value (RWF)"],
          rows: e.months.map((m) => [monthLabel(m.month, true), m.bookings, m.guestNights, m.valueRwf]),
        },
        {
          title: "Open businesses by kind",
          columns: ["Kind", "Businesses"],
          rows: e.activeBusinesses.map((b) => [b.label, b.count]),
        },
        {
          title: "Businesses selling the most stays",
          columns: ["Business", "Bookings", "Guest nights", "Booked value (RWF)"],
          rows: e.topBusinesses.map((b) => [b.legalName, b.bookings, b.guestNights, b.valueRwf]),
        },
      ];
    }
    case "members": {
      const n = r.now;
      return [
        {
          title: "Standing today",
          columns: ["Standing", "Businesses"],
          rows: [
            ["Members", n.members],
            ["Approved, fee not paid", n.awaitingPayment],
            ["Waiting on PSF", n.waiting],
            ["Lapsed", n.lapsed],
          ],
        },
        {
          title: "Renewals ahead",
          columns: ["Window", "Memberships"],
          rows: [
            ["Within 30 days", n.expiringIn30Days],
            ["Within 60 days", n.expiringIn60Days],
            ["Within 90 days", n.expiringIn90Days],
          ],
        },
        {
          title: "Members by tier",
          columns: ["Tier", "Members", "Yearly fees (RWF)"],
          rows: r.byFamily.map((f) => [f.label, f.count, f.amountRwf]),
        },
        months,
      ];
    }
    default:
      return [
        {
          title: "Waiting on you",
          columns: ["What", "How many"],
          rows: [
            ["Membership applications", r.now.waiting],
            ["Businesses to approve", r.registrations.waitingReview],
            ["Card holders to confirm", r.now.claimsWaiting],
            ["Renewals due in 30 days", r.now.expiringIn30Days],
          ],
        },
        ...csvFor("membership", r).slice(0, 1),
        ...csvFor("approvals", r).slice(1, 2),
        ...csvFor("economy", r).slice(0, 1),
        ...csvFor("members", r).slice(0, 1),
      ];
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────────────────────────

const AXES = {
  x: { dataKey: "label", tickLine: false, axisLine: false, tickMargin: 8, minTickGap: 8 },
  y: { tickLine: false, axisLine: false, width: 36, allowDecimals: false },
} as const;

/** Grouped bars over the months, one colour per series in the design system's fixed order. */
function MonthBars({
  title,
  description,
  rows,
  series,
  noun,
  className,
  empty,
}: {
  title: string;
  description: string;
  rows: ({ month: string } & Record<string, number | string>)[];
  series: { key: string; label: string }[];
  noun: string;
  className?: string;
  empty: string;
}) {
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month) }));
  const total = (key: string) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
  const isEmpty = series.every((s) => total(s.key) === 0);
  return (
    <ChartCard
      className={className}
      title={title}
      description={description}
      legend={series.length > 1 ? series.map((s, i) => ({ label: s.label, color: CHART_COLOR.cat(i + 1) })) : undefined}
      isEmpty={isEmpty}
      empty={{ icon: "ChartColumn", title: empty }}
      summary={series.map((s) => `${formatNumber(total(s.key))} ${s.label.toLowerCase()}`).join(", ") + ` ${noun}.`}
      table={{
        columns: ["Month", ...series.map((s) => s.label)],
        rows: rows.map((r) => [monthLabel(r.month, true), ...series.map((s) => formatNumber(Number(r[s.key] ?? 0)))]),
      }}
    >
      <BarChart data={data} height={240} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <BarChart.Grid vertical={false} />
        <BarChart.XAxis {...AXES.x} />
        <BarChart.YAxis {...AXES.y} />
        <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
        {series.map((s, i) => (
          <BarChart.Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={CHART_COLOR.cat(i + 1)}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        ))}
      </BarChart>
    </ChartCard>
  );
}

/** Money over the months, as a filled line. */
function MoneyArea({
  title,
  description,
  rows,
  className,
  empty,
}: {
  title: string;
  description: string;
  rows: { month: string; value: number }[];
  className?: string;
  empty: string;
}) {
  const id = useId().replace(/:/g, "");
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month) }));
  const total = rows.reduce((n, r) => n + r.value, 0);
  const best = rows.reduce<{ month: string; value: number } | null>((b, r) => (!b || r.value > b.value ? r : b), null);
  return (
    <ChartCard
      className={className}
      title={title}
      description={description}
      isEmpty={total === 0}
      empty={{ icon: "Wallet", title: empty }}
      summary={`${formatMoney(total)} in all.${best && best.value > 0 ? ` The best month was ${monthLabel(best.month, true)} with ${formatMoney(best.value)}.` : ""}`}
      table={{
        columns: ["Month", "RWF"],
        rows: rows.map((r) => [monthLabel(r.month, true), formatMoney(r.value, { bare: true })]),
      }}
    >
      <AreaChart data={data} height={240} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <AreaChart.Grid vertical={false} />
        <AreaChart.XAxis {...AXES.x} padding={{ left: 12, right: 12 }} />
        <AreaChart.YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatMoneyAxis(v)}
        />
        <AreaChart.Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={<AreaChart.TooltipContent valueFormatter={(v: number | string) => formatMoney(Number(v))} />}
        />
        <AreaChart.Area
          dataKey="value"
          name="RWF"
          type="monotone"
          stroke={CHART_COLOR.cat(1)}
          strokeWidth={2}
          fill={`url(#${id}-fill)`}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
        />
      </AreaChart>
    </ChartCard>
  );
}

/** Steps of a funnel, each bar against the first. */
function Funnel({ steps }: { steps: { label: string; count: number }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1">{s.label}</span>
            {i > 0 ? <span className="text-xs text-muted tabular">{Math.round((s.count / top) * 100)}%</span> : null}
            <span className="w-10 text-right font-medium tabular">{formatNumber(s.count)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-default">
            <div
              className="h-full rounded-full"
              style={{ width: `${(s.count / top) * 100}%`, background: CHART_COLOR.cat(1) }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── The reports ───────────────────────────────────────────────────────────────────────────────────

function Overview({ r }: { r: PsfReport }) {
  const amount = useFeeAmount(r.fees.ourShare);
  const view = useFeeView();
  const g = r.registrations;
  const k = r.kpis;
  const e = r.economy;
  const n = r.now;
  const cards: { id: PsfReportId; figures: { label: string; value: string }[]; spark: number[] }[] = [
    {
      id: "membership",
      figures: [
        { label: "Applied", value: formatNumber(k.applied.value) },
        { label: "Approved", value: formatNumber(k.approved.value) },
        { label: view === "ours" ? "Our revenue" : "All fees", value: formatMoney(amount(psfFeeTotal(r.fees.current)), { compact: true }) },
      ],
      spark: r.months.map((m) => m.applied),
    },
    {
      id: "approvals",
      figures: [
        { label: "Approved", value: formatNumber(g.approvedInPeriod.value) },
        { label: "Rejected", value: formatNumber(g.rejectedInPeriod.value) },
        { label: "Time to decide", value: days(g.medianDaysToDecision) },
      ],
      spark: g.months.map((m) => m.approved),
    },
    {
      id: "economy",
      figures: [
        { label: "Bookings", value: formatNumber(e.bookings.value) },
        { label: "Guest nights", value: formatNumber(e.guestNights.value) },
        { label: "Booked", value: formatMoney(e.bookedValueRwf.value, { compact: true }) },
      ],
      spark: e.months.map((m) => m.guestNights),
    },
    {
      id: "members",
      figures: [
        { label: "Members", value: formatNumber(n.members) },
        { label: "Renew in 90 days", value: formatNumber(n.expiringIn90Days) },
        { label: "Lapsed", value: formatNumber(n.lapsed) },
      ],
      spark: r.months.map((m) => m.members),
    },
  ];
  return (
    <>
      <KpiStrip
        label="Waiting on you"
        items={[
          {
            id: "apps",
            label: "Membership applications",
            value: n.waiting,
            format: "count",
            icon: "FileText",
            status: n.overdue > 0 ? "danger" : n.waiting > 0 ? "warning" : undefined,
            footnote:
              n.overdue > 0
                ? `${formatNumber(n.overdue)} overdue · decide them`
                : n.waiting
                  ? "Decide them"
                  : "None waiting",
            href: "/psf",
          },
          {
            id: "approve",
            label: "Businesses to approve",
            value: g.waitingReview,
            format: "count",
            icon: "ShieldCheck",
            status: g.waitingReview > 0 ? "warning" : undefined,
            footnote: g.oldestWaitingDays === null ? "None waiting" : `Oldest waiting ${days(g.oldestWaitingDays)}`,
            href: "/officer",
          },
          {
            id: "claims",
            label: "Card holders to confirm",
            value: n.claimsWaiting,
            format: "count",
            icon: "CircleCheck",
            status: n.claimsWaiting > 0 ? "warning" : undefined,
            footnote: n.claimsWaiting ? "Check the numbers" : "None waiting",
            href: "/psf/claims",
          },
          {
            id: "renew",
            label: "Renewals due in 30 days",
            value: n.expiringIn30Days,
            format: "count",
            icon: "Clock",
            status: n.expiringIn30Days > 0 ? "warning" : undefined,
            footnote: n.lapsed > 0 ? `${formatNumber(n.lapsed)} lapsed, not renewed` : "No lapsed members",
            href: "/psf/register?standing=member",
          },
        ]}
      />
      <FeeStrip kinds={r.fees.current} previous={r.fees.previous} ours={r.fees.ourShare} />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const meta = PSF_REPORTS.find((x) => x.id === c.id);
          const spark = c.spark.map((v, i) => ({ i, v }));
          return (
            <SectionCard
              key={c.id}
              title={meta?.title ?? c.id}
              description={meta?.blurb}
              actions={
                <ActionLink href={view === "ours" ? `${reportHref(c.id)}?fees=ours` : reportHref(c.id)} icon="ArrowRight" size="sm">
                  Open
                </ActionLink>
              }
            >
              <div className="grid grid-cols-3 gap-3">
                {c.figures.map((f) => (
                  <div key={f.label} className="flex min-w-0 flex-col">
                    <span className="truncate text-xs text-muted">{f.label}</span>
                    <span className="text-lg font-semibold tabular">{f.value}</span>
                  </div>
                ))}
              </div>
              {c.spark.some((v) => v > 0) ? (
                <div aria-hidden="true" className="h-14">
                  <BarChart data={spark} height={56} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <BarChart.Bar dataKey="v" fill={CHART_COLOR.cat(1)} radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </div>
              ) : (
                <p className="flex h-14 items-center text-xs text-muted">
                  Nothing to chart in the last twelve months yet.
                </p>
              )}
            </SectionCard>
          );
        })}
      </div>
    </>
  );
}

function Membership({ r }: { r: PsfReport }) {
  const k = r.kpis;
  const amount = useFeeAmount(r.fees.ourShare);
  const view = useFeeView();
  return (
    <>
      <KpiStrip
        label="Membership in the period"
        items={[
          {
            id: "applied",
            label: "Applied",
            value: k.applied.value,
            format: "count",
            icon: "FileText",
            trend: trend(k.applied),
          },
          {
            id: "approved",
            label: "Approved",
            value: k.approved.value,
            format: "count",
            icon: "CircleCheck",
            trend: trend(k.approved),
          },
          {
            id: "new",
            label: "New members",
            value: k.newMembers.value,
            format: "count",
            icon: "Persons",
            trend: trend(k.newMembers),
          },
          waitKpi("days", k.medianDecisionDays.value, "from applying"),
        ]}
      />
      <FeeStrip kinds={r.fees.current} previous={r.fees.previous} ours={r.fees.ourShare} />
      {/* How members came in (2026-11-02): new, renewed, and old card holders brought into the new module. */}
      <KpiStrip
        label="How members came in"
        items={[
          { id: "in-new", label: "New members", value: k.newMembers.value, format: "count", icon: "PersonPlus", trend: trend(k.newMembers) },
          { id: "in-renewed", label: "Renewed", value: k.renewed.value, format: "count", icon: "ArrowRotateRight", trend: trend(k.renewed) },
          { id: "in-upgraded", label: "Upgraded", value: k.upgraded.value, format: "count", icon: "ArrowUp", trend: trend(k.upgraded) },
          { id: "in-cards", label: "Card holders brought in", value: k.cardHolders.value, format: "count", icon: "CreditCard", trend: trend(k.cardHolders) },
        ]}
      />
      {/* Who the fees are for (2026-11-05): a record, the money goes to PSF's one account. */}
      <SectionCard title="Where the money goes" description={`Today, each fee splits ${r.split.districtPercent}% for its district and ${100 - r.split.districtPercent}% for headquarters. The money reaches PSF's one account. See Money for every region and district.`}>
        <KpiStrip
          label="The split"
          items={[
            { id: "split-total", label: "Fees in the period", value: r.split.totalRwf, format: "money", icon: "Wallet" },
            { id: "split-district", label: "Districts' share", value: r.split.districtRwf, format: "money", icon: "MapPin" },
            { id: "split-hq", label: "Headquarters' share", value: r.split.headquartersRwf, format: "money", icon: "Briefcase" },
          ]}
        />
        {r.split.byDistrict.length > 1 ? (
          <ul className="mt-3 flex flex-col divide-y divide-separator text-sm">
            {r.split.byDistrict.map((d) => (
              <li key={d.districtName} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
                <span className="font-medium">{d.districtName}</span>
                <span className="tabular text-muted">
                  {formatMoney(d.districtRwf)} of {formatMoney(d.totalRwf)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title="Applications by month"
          description="Made, and approved, each month"
          rows={barMonths(r)}
          series={[
            { key: "applied", label: "Applied" },
            { key: "approved", label: "Approved" },
          ]}
          noun="over the last twelve months"
          empty="No application in these months"
        />
        <CountDonut
          title="Members by tier"
          description="Today"
          totalLabel="Members"
          noun="members"
          data={tierSlices(r)}
          empty={{ icon: "Persons", title: "No member yet" }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MoneyArea
          className="lg:col-span-2"
          title={view === "ours" ? "Our revenue by month" : "All fees by month"}
          description="New memberships, renewals and upgrades"
          rows={r.months.map((m) => ({ month: m.month, value: amount(psfFeeTotal(m.fees)) }))}
          empty="No fee paid in these months"
        />
        <CountDonut
          title="Who owns them"
          description="Businesses on the register"
          totalLabel="Businesses"
          noun="businesses"
          data={r.byGroup.map((g) => ({ key: g.key, label: g.label, count: g.count }))}
          empty={{ icon: "Persons", title: "No owner group declared yet", action: undefined }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SectionCard title="From application to member" description="Applications made in the period">
          <Funnel
            steps={[
              { label: "Applied", count: r.funnel.registered },
              { label: "Approved", count: r.funnel.approved },
              { label: "Paid, now members", count: r.funnel.paid },
              { label: "Sent back", count: r.funnel.declined },
            ]}
          />
        </SectionCard>
        <SectionCard title="By PSF sector" className="lg:col-span-2" contentClassName="gap-0">
          <DataTable
            label="By PSF sector"
            rows={r.bySector}
            rowKey={(s) => s.key}
            defaultSort={{ column: "count", direction: "descending" }}
            empty={<EmptyBlock size="sm" icon="Briefcase" title="No business in a PSF sector yet" />}
            columns={[
              { id: "label", header: "Sector", isRowHeader: true, sortValue: (s) => s.label, cell: (s) => s.label },
              {
                id: "count",
                header: "Businesses",
                align: "end",
                sortValue: (s) => s.count,
                cell: (s) => <span className="tabular">{formatNumber(s.count)}</span>,
              },
              {
                id: "fees",
                header: view === "ours" ? "Our revenue" : "All fees",
                align: "end",
                sortValue: (s) => amount({ totalRwf: s.amountRwf, districtRwf: s.districtRwf, headquartersRwf: s.headquartersRwf }),
                cell: (s) => <span className="tabular">{formatMoney(amount({ totalRwf: s.amountRwf, districtRwf: s.districtRwf, headquartersRwf: s.headquartersRwf }))}</span>,
              },
            ]}
            mobile={{
              title: (s) => s.label,
              trailing: (s) => <span className="font-medium tabular">{formatNumber(s.count)}</span>,
            }}
          />
        </SectionCard>
      </div>
      {r.districts.length > 0 ? (
        <SectionCard title="By district" contentClassName="gap-0">
          <DataTable
            label="By district"
            rows={r.districts}
            rowKey={(d) => String(d.districtId)}
            defaultSort={{ column: "members", direction: "descending" }}
            columns={[
              { id: "name", header: "District", isRowHeader: true, sortValue: (d) => d.name, cell: (d) => d.name },
              {
                id: "waiting",
                header: "Waiting",
                align: "end",
                sortValue: (d) => d.waiting,
                cell: (d) => formatNumber(d.waiting),
              },
              {
                id: "overdue",
                header: "Overdue",
                align: "end",
                sortValue: (d) => d.overdue,
                cell: (d) => formatNumber(d.overdue),
              },
              {
                id: "members",
                header: "Members",
                align: "end",
                sortValue: (d) => d.members,
                cell: (d) => formatNumber(d.members),
              },
              {
                id: "fees-new",
                header: "New",
                align: "end",
                sortValue: (d) => amount(d.fees.application),
                cell: (d) => formatMoney(amount(d.fees.application)),
              },
              {
                id: "fees-renewal",
                header: "Renewals",
                align: "end",
                sortValue: (d) => amount(d.fees.renewal),
                cell: (d) => formatMoney(amount(d.fees.renewal)),
              },
              {
                id: "fees-upgrade",
                header: "Upgrades",
                align: "end",
                sortValue: (d) => amount(d.fees.upgrade),
                cell: (d) => formatMoney(amount(d.fees.upgrade)),
              },
              {
                id: "fees",
                header: view === "ours" ? "Our revenue" : "All fees",
                align: "end",
                sortValue: (d) => amount(psfFeeTotal(d.fees)),
                cell: (d) => formatMoney(amount(psfFeeTotal(d.fees))),
              },
            ]}
            mobile={{ title: (d) => d.name, trailing: (d) => formatNumber(d.members) }}
          />
        </SectionCard>
      ) : null}
    </>
  );
}

const STATUS_WORD: Record<string, string> = {
  active: "Open",
  approved: "Approved, owner to claim",
  rejected: "Rejected",
  suspended: "Suspended",
  submitted: "In review",
  tin_verified: "In review",
  field_verified: "Waiting for approval",
};

function Approvals({ r }: { r: PsfReport }) {
  const g = r.registrations;
  return (
    <>
      <KpiStrip
        label="Business approvals"
        items={[
          {
            id: "waiting",
            label: "To review",
            value: g.waitingReview,
            format: "count",
            icon: "ShieldCheck",
            status: g.waitingReview > 0 ? "warning" : undefined,
            footnote: g.waitingReview ? "Review them" : "None waiting",
            href: "/officer",
          },
          {
            id: "approved",
            label: "Approved",
            value: g.approvedInPeriod.value,
            format: "count",
            icon: "CircleCheck",
            trend: trend(g.approvedInPeriod),
          },
          {
            id: "rejected",
            label: "Rejected",
            value: g.rejectedInPeriod.value,
            format: "count",
            icon: "FileCheck",
            trend: trend(g.rejectedInPeriod, "down"),
          },
          waitKpi("days", g.medianDaysToDecision, "from the fee"),
          {
            id: "unpaid",
            label: "Fee not paid",
            value: g.waitingPayment,
            format: "count",
            icon: "Wallet",
            footnote: "Started, not yet in review",
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title="Registrations by month"
          description="Fees paid, and the decisions taken"
          rows={g.months}
          series={[
            { key: "submitted", label: "Fees paid" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
          ]}
          noun="over the last twelve months"
          empty="No registration in these months"
        />
        <CountDonut
          title="Where every registration stands"
          description="Today"
          totalLabel="Businesses"
          noun="businesses"
          data={[
            { key: "review", label: "Waiting for review", count: g.waitingReview },
            { key: "approval", label: "Waiting for approval", count: g.waitingApproval },
            { key: "open", label: "Approved and open", count: g.active },
            { key: "rejected", label: "Rejected", count: g.rejected },
            { key: "suspended", label: "Suspended", count: g.suspended },
          ]}
          empty={{ icon: "ShieldCheck", title: "No registration yet" }}
        />
      </div>
      <SectionCard
        title="Businesses decided in the period"
        description="Open one to see its documents, who decided and whether guests can book it"
        contentClassName="gap-0"
      >
        <DataTable
          label="Businesses decided in the period"
          rows={g.decided}
          rowKey={(d) => `${d.orgId}-${d.decidedAt}`}
          defaultSort={{ column: "when", direction: "descending" }}
          empty={<EmptyBlock size="sm" icon="ShieldCheck" title="No business decided in this period" />}
          columns={[
            {
              id: "name",
              header: "Business",
              isRowHeader: true,
              sortValue: (d) => d.legalName,
              cell: (d) => (
                <NextLink href={businessHref(d.orgId)} className="font-medium text-foreground hover:underline">
                  {d.legalName}
                </NextLink>
              ),
            },
            { id: "kind", header: "Kind", sortValue: (d) => d.kindLabel, cell: (d) => d.kindLabel },
            {
              id: "decision",
              header: "Decision",
              sortValue: (d) => d.decision,
              cell: (d) => (
                <StatusChip tone={d.decision === "approved" ? "success" : "danger"}>
                  {d.decision === "approved" ? "Approved" : "Rejected"}
                </StatusChip>
              ),
            },
            { id: "by", header: "Decided by", sortValue: (d) => d.decidedBy ?? "", cell: (d) => d.decidedBy ?? "—" },
            { id: "when", header: "Date", sortValue: (d) => d.decidedAt, cell: (d) => formatDay(d.decidedAt) },
            { id: "now", header: "Now", sortValue: (d) => d.status, cell: (d) => STATUS_WORD[d.status] ?? d.status },
          ]}
          mobile={{
            title: (d) => (
              <NextLink href={businessHref(d.orgId)} className="text-foreground">
                {d.legalName}
              </NextLink>
            ),
            description: (d) => `${d.kindLabel} · ${formatDay(d.decidedAt)}`,
            trailing: (d) => (
              <StatusChip tone={d.decision === "approved" ? "success" : "danger"}>
                {d.decision === "approved" ? "Approved" : "Rejected"}
              </StatusChip>
            ),
          }}
        />
      </SectionCard>
    </>
  );
}

function Economy({ r }: { r: PsfReport }) {
  const e = r.economy;
  const open = e.activeBusinesses.reduce((n, b) => n + b.count, 0);
  return (
    <>
      <KpiStrip
        label="District economy"
        items={[
          {
            id: "open",
            label: "Open businesses",
            value: open,
            format: "count",
            icon: "House",
            footnote: "Approved on Injishi",
          },
          {
            id: "bookings",
            label: "Bookings arriving",
            value: e.bookings.value,
            format: "count",
            icon: "Calendar",
            trend: trend(e.bookings),
          },
          {
            id: "nights",
            label: "Guest nights",
            value: e.guestNights.value,
            format: "count",
            icon: "Persons",
            trend: trend(e.guestNights),
          },
          {
            id: "value",
            label: "Booked value",
            value: e.bookedValueRwf.value,
            format: "money",
            icon: "Wallet",
            trend: trend(e.bookedValueRwf),
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title="Stays by month"
          description="By the month guests arrive"
          rows={e.months}
          series={[
            { key: "bookings", label: "Bookings" },
            { key: "guestNights", label: "Guest nights" },
          ]}
          noun="over the last twelve months"
          empty="No stay booked in these months"
        />
        <CountDonut
          title="Open businesses by kind"
          description="Today"
          totalLabel="Businesses"
          noun="businesses"
          data={e.activeBusinesses.map((b) => ({ key: b.key, label: b.label, count: b.count }))}
          empty={{ icon: "House", title: "No business is open yet" }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MoneyArea
          className="lg:col-span-2"
          title="Booked value by month"
          description="What the stays arriving each month are worth"
          rows={e.months.map((m) => ({ month: m.month, value: m.valueRwf }))}
          empty="No stay booked in these months"
        />
        <SectionCard title="Selling the most stays" description="In the period" contentClassName="gap-0">
          {e.topBusinesses.length === 0 ? (
            <EmptyBlock size="sm" icon="House" title="No stay booked in this period" />
          ) : (
            <ol className="flex flex-col">
              {e.topBusinesses.map((b, i) => (
                <li key={b.orgId} className="flex items-center gap-3 border-t border-separator py-2.5 first:border-t-0">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <NextLink
                      href={businessHref(b.orgId)}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {b.legalName}
                    </NextLink>
                    <span className="text-xs text-muted">
                      {formatNumber(b.bookings)} bookings · {formatNumber(b.guestNights)} guest nights
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular">{formatMoney(b.valueRwf, { compact: true })}</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function Members({ r }: { r: PsfReport }) {
  const n = r.now;
  const windows = [
    { month: "0", label: "Within 30 days", count: n.expiringIn30Days },
    { month: "1", label: "31 to 60 days", count: Math.max(0, n.expiringIn60Days - n.expiringIn30Days) },
    { month: "2", label: "61 to 90 days", count: Math.max(0, n.expiringIn90Days - n.expiringIn60Days) },
  ];
  return (
    <>
      <KpiStrip
        label="Member register today"
        items={[
          {
            id: "members",
            label: "Members",
            value: n.members,
            format: "count",
            icon: "Persons",
            href: "/psf/register?standing=member",
          },
          {
            id: "unpaid",
            label: "Approved, fee not paid",
            value: n.awaitingPayment,
            format: "count",
            icon: "Wallet",
            footnote: "Members once they pay",
          },
          {
            id: "renew",
            label: "Renew in 30 days",
            value: n.expiringIn30Days,
            format: "count",
            icon: "Clock",
            status: n.expiringIn30Days > 0 ? "warning" : undefined,
          },
          {
            id: "lapsed",
            label: "Lapsed",
            value: n.lapsed,
            format: "count",
            icon: "Calendar",
            status: n.lapsed > 0 ? "danger" : undefined,
            footnote: "Past their end, not renewed",
            href: "/psf/register?standing=lapsed",
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Renewals ahead"
          description="Memberships ending in the next 90 days"
          isEmpty={n.expiringIn90Days === 0}
          empty={{ icon: "Calendar", title: "No membership ends in the next 90 days" }}
          summary={`${formatNumber(n.expiringIn90Days)} memberships end in the next 90 days, ${formatNumber(n.expiringIn30Days)} of them within 30.`}
          table={{ columns: ["Window", "Memberships"], rows: windows.map((w) => [w.label, formatNumber(w.count)]) }}
        >
          <BarChart data={windows} height={220} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <BarChart.Grid vertical={false} />
            <BarChart.XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <BarChart.YAxis {...AXES.y} />
            <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
            <BarChart.Bar
              dataKey="count"
              name="Memberships"
              fill={CHART_COLOR.cat(1)}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartCard>
        <CountDonut
          title="Standing"
          description="Every business with PSF today"
          totalLabel="Businesses"
          noun="businesses"
          data={[
            { key: "member", label: "Members", count: n.members },
            { key: "unpaid", label: "Approved, not paid", count: n.awaitingPayment },
            { key: "waiting", label: "Waiting on PSF", count: n.waiting },
            { key: "lapsed", label: "Lapsed", count: n.lapsed },
          ]}
          empty={{ icon: "Persons", title: "No business with PSF yet" }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title="New members by month"
          description="Memberships that began each month"
          rows={barMonths(r)}
          series={[{ key: "members", label: "New members" }]}
          noun="over the last twelve months"
          empty="No membership began in these months"
        />
        <CountDonut
          title="Members by tier"
          description="Today"
          totalLabel="Members"
          noun="members"
          data={tierSlices(r)}
          empty={{ icon: "Persons", title: "No member yet" }}
        />
      </div>
    </>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The PSF District Manager's reports (2026-10-30), one per page: each has its period, its own charts and
 * tables, a CSV download and a print view that keeps only the report, so any one of them can be sent on.
 */
export function PsfReportsView({
  id,
  scope,
  report,
  today,
}: {
  id: PsfReportId;
  scope: PsfScope;
  report: PsfReport;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const meta = PSF_REPORTS.find((r) => r.id === id) ?? PSF_REPORTS[0];
  const period = periodFromRange(report.from, report.to, today);
  const span = `${formatDay(report.from)} to ${formatDay(report.to)}`;
  // Every part of the report, as CSV, Excel, PDF or Word (2026-11-02).
  const exportRows = async (): Promise<ExportTable> => ({
    filename: `psf-${id}-${report.from}-to-${report.to}`,
    title: `PSF · ${meta.title}`,
    subtitle: `${report.regionLabel}, ${span} · ${scope.title}`,
    sections: csvFor(id, report).map((sec) => ({ title: sec.title, heading: sec.columns, rows: sec.rows })),
  });
  return (
    <div data-print-root="">
      <PageContent>
        <PageHeader
          eyebrow={`${scope.title} · ${report.regionLabel}`}
          title={meta.title}
          description={`${meta.blurb} ${span}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <ExportMenu load={exportRows} />
              <ActionButton icon="Printer" intent="primary" onPress={() => window.print()}>
                Print
              </ActionButton>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <PeriodPicker
            value={period}
            today={today}
            allowFuture
            maxDays={731}
            onChange={(p) => router.push(`${pathname}?from=${p.start}&to=${p.end}${params.get("fees") === "ours" ? "&fees=ours" : ""}`, { scroll: false })}
            label="Report period"
          />
          <span className="text-xs text-muted">
            Figures today, like renewals and standing, do not depend on the period.
          </span>
          {id === "overview" || id === "membership" ? <FeeViewSwitch ours={report.fees.ourShare} districtPercent={report.split.districtPercent} /> : null}
        </div>
        {id === "membership" ? (
          <Membership r={report} />
        ) : id === "approvals" ? (
          <Approvals r={report} />
        ) : id === "economy" ? (
          <Economy r={report} />
        ) : id === "members" ? (
          <Members r={report} />
        ) : (
          <Overview r={report} />
        )}
      </PageContent>
    </div>
  );
}
