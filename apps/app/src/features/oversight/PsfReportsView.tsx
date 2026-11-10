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
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportTable } from "@/lib/table-export";
import type { PsfReport, PsfScope } from "@/server/sources/psf";

import { FeeStrip, FeeViewSwitch, useFeeAmount, useFeeView } from "./psf-fee-view";
import { PSF_REPORTS, type PsfReportId } from "./psf-reports";

export { PSF_REPORTS, type PsfReportId };


const reportHref = (id: PsfReportId) => `/psf/report/${id}`;
const businessHref = (orgId: string) => `/psf/register/${orgId}`;

/** "2026-10" → "Oct", or "Oct 2026" in full, in the reader's language. */
function monthLabel(month: string, full = false, locale = "en-GB"): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** A KPI's change against the period before, for the strip's trend line. */
function trend(
  kpi: { value: number; previous: number },
  goodWhen: "up" | "down" = "up",
  versus = "the period before",
): KpiItem["trend"] {
  if (kpi.previous === 0) return undefined;
  return {
    percent: Math.round(((kpi.value - kpi.previous) / kpi.previous) * 100),
    goodWhen,
    versus,
  };
}

/** The report titles and blurbs, in the reader's language. */
function useReportMeta(): Record<PsfReportId, { title: string; blurb: string }> {
  const t = useTranslations("psfReports");
  return {
    overview: { title: t("meta.overview.title"), blurb: t("meta.overview.blurb") },
    membership: { title: t("meta.membership.title"), blurb: t("meta.membership.blurb") },
    approvals: { title: t("meta.approvals.title"), blurb: t("meta.approvals.blurb") },
    economy: { title: t("meta.economy.title"), blurb: t("meta.economy.blurb") },
    members: { title: t("meta.members.title"), blurb: t("meta.members.blurb") },
  };
}

/** The months as the bar charts read them: counts, without the fees' breakdown. */
const barMonths = (r: PsfReport) => r.months.map(({ fees: _fees, ...m }) => m);

/** Members by tier, with the members whose membership names no tier (declared, not applied for). */
function tierSlices(r: PsfReport, noTier: string) {
  const slices = r.byFamily.map((f) => ({ key: f.key, label: f.label, count: f.count }));
  const untiered = r.now.members - slices.reduce((n, f) => n + f.count, 0);
  return untiered > 0 ? [...slices, { key: "none", label: noTier, count: untiered }] : slices;
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
  const t = useTranslations("psfReports");
  const locale = useLocale();
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month, false, locale) }));
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
        columns: [t("common.month"), ...series.map((s) => s.label)],
        rows: rows.map((r) => [
          monthLabel(r.month, true, locale),
          ...series.map((s) => formatNumber(Number(r[s.key] ?? 0))),
        ]),
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
  const t = useTranslations("psfReports");
  const locale = useLocale();
  const id = useId().replace(/:/g, "");
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month, false, locale) }));
  const total = rows.reduce((n, r) => n + r.value, 0);
  const best = rows.reduce<{ month: string; value: number } | null>((b, r) => (!b || r.value > b.value ? r : b), null);
  return (
    <ChartCard
      className={className}
      title={title}
      description={description}
      isEmpty={total === 0}
      empty={{ icon: "Wallet", title: empty }}
      summary={`${t("common.inAll", { total: formatMoney(total) })}${best && best.value > 0 ? ` ${t("common.bestMonth", { month: monthLabel(best.month, true, locale), amount: formatMoney(best.value) })}` : ""}`}
      table={{
        columns: [t("common.month"), "RWF"],
        rows: rows.map((r) => [monthLabel(r.month, true, locale), formatMoney(r.value, { bare: true })]),
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
  const t = useTranslations("psfReports");
  const meta = useReportMeta();
  const amount = useFeeAmount(r.fees.ourShare);
  const view = useFeeView();
  const g = r.registrations;
  const k = r.kpis;
  const e = r.economy;
  const n = r.now;
  const days = (value: number | null) =>
    value === null
      ? "—"
      : value < 1
        ? t("common.underADay")
        : t("common.days", { count: Math.round(value) });
  const cards: { id: PsfReportId; figures: { label: string; value: string }[]; spark: number[] }[] = [
    {
      id: "membership",
      figures: [
        { label: t("common.applied"), value: formatNumber(k.applied.value) },
        { label: t("common.approved"), value: formatNumber(k.approved.value) },
        { label: view === "ours" ? t("common.ourRevenue") : t("common.allFees"), value: formatMoney(amount(psfFeeTotal(r.fees.current)), { compact: true }) },
      ],
      spark: r.months.map((m) => m.applied),
    },
    {
      id: "approvals",
      figures: [
        { label: t("common.approved"), value: formatNumber(g.approvedInPeriod.value) },
        { label: t("common.rejected"), value: formatNumber(g.rejectedInPeriod.value) },
        { label: t("common.timeToDecide"), value: days(g.medianDaysToDecision) },
      ],
      spark: g.months.map((m) => m.approved),
    },
    {
      id: "economy",
      figures: [
        { label: t("common.bookings"), value: formatNumber(e.bookings.value) },
        { label: t("common.guestNights"), value: formatNumber(e.guestNights.value) },
        { label: t("overview.booked"), value: formatMoney(e.bookedValueRwf.value, { compact: true }) },
      ],
      spark: e.months.map((m) => m.guestNights),
    },
    {
      id: "members",
      figures: [
        { label: t("overview.members"), value: formatNumber(n.members) },
        { label: t("overview.renewIn90"), value: formatNumber(n.expiringIn90Days) },
        { label: t("overview.lapsed"), value: formatNumber(n.lapsed) },
      ],
      spark: r.months.map((m) => m.members),
    },
  ];
  return (
    <>
      <KpiStrip
        label={t("overview.waitingOnYou")}
        items={[
          {
            id: "apps",
            label: t("overview.membershipApplications"),
            value: n.waiting,
            format: "count",
            icon: "FileText",
            status: n.overdue > 0 ? "danger" : n.waiting > 0 ? "warning" : undefined,
            footnote:
              n.overdue > 0
                ? t("overview.overdueDecide", { count: formatNumber(n.overdue) })
                : n.waiting
                  ? t("overview.decideThem")
                  : t("overview.noneWaiting"),
            href: "/psf",
          },
          {
            id: "approve",
            label: t("overview.businessesToApprove"),
            value: g.waitingReview,
            format: "count",
            icon: "ShieldCheck",
            status: g.waitingReview > 0 ? "warning" : undefined,
            footnote:
              g.oldestWaitingDays === null
                ? t("overview.noneWaiting")
                : t("overview.oldestWaiting", { wait: days(g.oldestWaitingDays) }),
            href: "/officer",
          },
          {
            id: "claims",
            label: t("overview.cardHolders"),
            value: n.claimsWaiting,
            format: "count",
            icon: "CircleCheck",
            status: n.claimsWaiting > 0 ? "warning" : undefined,
            footnote: n.claimsWaiting ? t("overview.checkNumbers") : t("overview.noneWaiting"),
            href: "/psf/claims",
          },
          {
            id: "renew",
            label: t("overview.renewalsDue"),
            value: n.expiringIn30Days,
            format: "count",
            icon: "Clock",
            status: n.expiringIn30Days > 0 ? "warning" : undefined,
            footnote:
              n.lapsed > 0
                ? t("overview.lapsedNotRenewed", { count: formatNumber(n.lapsed) })
                : t("overview.noLapsed"),
            href: "/psf/register?standing=member",
          },
        ]}
      />
      <FeeStrip kinds={r.fees.current} previous={r.fees.previous} ours={r.fees.ourShare} />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const spark = c.spark.map((v, i) => ({ i, v }));
          return (
            <SectionCard
              key={c.id}
              title={meta[c.id].title}
              description={meta[c.id].blurb}
              actions={
                <ActionLink href={view === "ours" ? `${reportHref(c.id)}?fees=ours` : reportHref(c.id)} icon="ArrowRight" size="sm">
                  {t("overview.openReport")}
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
                <p className="flex h-14 items-center text-xs text-muted">{t("overview.nothingToChart")}</p>
              )}
            </SectionCard>
          );
        })}
      </div>
    </>
  );
}

function Membership({ r }: { r: PsfReport }) {
  const t = useTranslations("psfReports");
  const periodBefore = t("common.periodBefore");
  const k = r.kpis;
  const days = (value: number | null) =>
    value === null
      ? "—"
      : value < 1
        ? t("common.underADay")
        : t("common.days", { count: Math.round(value) });
  const waitKpi = (id: string, value: number | null, from: string): KpiItem => {
    if (value === null)
      return {
        id,
        label: t("common.timeToDecide"),
        value: 0,
        format: "count",
        icon: "Clock",
        footnote: t("common.nothingDecided"),
      };
    const hours = value < 1;
    return {
      id,
      label: t("common.timeToDecide"),
      value: hours ? Math.max(1, Math.round(value * 24)) : Math.round(value * 10) / 10,
      format: "count",
      icon: "Clock",
      footnote: `${hours ? t("common.medianHours") : t("common.medianDays")}, ${from}`,
    };
  };
  const amount = useFeeAmount(r.fees.ourShare);
  const view = useFeeView();
  return (
    <>
      <KpiStrip
        label={t("membership.title")}
        items={[
          {
            id: "applied",
            label: t("common.applied"),
            value: k.applied.value,
            format: "count",
            icon: "FileText",
            trend: trend(k.applied, "up", periodBefore),
          },
          {
            id: "approved",
            label: t("common.approved"),
            value: k.approved.value,
            format: "count",
            icon: "CircleCheck",
            trend: trend(k.approved, "up", periodBefore),
          },
          {
            id: "new",
            label: t("common.newMembers"),
            value: k.newMembers.value,
            format: "count",
            icon: "Persons",
            trend: trend(k.newMembers, "up", periodBefore),
          },
          waitKpi("days", k.medianDecisionDays.value, t("membership.fromApplying")),
        ]}
      />
      <FeeStrip kinds={r.fees.current} previous={r.fees.previous} ours={r.fees.ourShare} />
      {/* How members came in (2026-11-02): new, renewed, and old card holders brought into the new module. */}
      <KpiStrip
        label={t("membership.howCameIn")}
        items={[
          {
            id: "in-new",
            label: t("common.newMembers"),
            value: k.newMembers.value,
            format: "count",
            icon: "PersonPlus",
            trend: trend(k.newMembers, "up", periodBefore),
          },
          {
            id: "in-renewed",
            label: t("common.renewed"),
            value: k.renewed.value,
            format: "count",
            icon: "ArrowRotateRight",
            trend: trend(k.renewed, "up", periodBefore),
          },
          {
            id: "in-upgraded",
            label: t("common.upgraded"),
            value: k.upgraded.value,
            format: "count",
            icon: "ArrowUp",
            trend: trend(k.upgraded, "up", periodBefore),
          },
          {
            id: "in-cards",
            label: t("membership.cardHoldersBrought"),
            value: k.cardHolders.value,
            format: "count",
            icon: "CreditCard",
            trend: trend(k.cardHolders, "up", periodBefore),
          },
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
          title={t("membership.applicationsByMonth")}
          description={t("membership.applicationsByMonthLead")}
          rows={barMonths(r)}
          series={[
            { key: "applied", label: t("common.applied") },
            { key: "approved", label: t("common.approved") },
          ]}
          noun={t("common.overTwelveMonths")}
          empty={t("membership.noApplication")}
        />
        <CountDonut
          title={t("membership.membersByTier")}
          description={t("common.today")}
          totalLabel={t("membership.totalMemberships")}
          noun={t("membership.memberNoun")}
          data={tierSlices(r, t("common.noTier"))}
          empty={{ icon: "Persons", title: t("membership.noMemberYet") }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MoneyArea
          className="lg:col-span-2"
          title={view === "ours" ? t("membership.ourRevenueByMonth") : t("membership.allFeesByMonth")}
          description={t("membership.feesByMonthLead")}
          rows={r.months.map((m) => ({ month: m.month, value: amount(psfFeeTotal(m.fees)) }))}
          empty={t("membership.noFeePaid")}
        />
        <CountDonut
          title={t("membership.whoOwns")}
          description={t("membership.onRegister")}
          totalLabel={t("membership.totalBusinessesLabel")}
          noun={t("membership.businessNoun")}
          data={r.byGroup.map((g) => ({ key: g.key, label: g.label, count: g.count }))}
          empty={{ icon: "Persons", title: t("membership.noOwnerGroup"), action: undefined }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SectionCard title={t("membership.fromApplicationToMember")} description={t("membership.applicationsInPeriod")}>
          <Funnel
            steps={[
              { label: t("common.applied"), count: r.funnel.registered },
              { label: t("common.approved"), count: r.funnel.approved },
              { label: t("membership.paidNowMembers"), count: r.funnel.paid },
              { label: t("common.sentBack"), count: r.funnel.declined },
            ]}
          />
        </SectionCard>
        <SectionCard title={t("membership.bySector")} className="lg:col-span-2" contentClassName="gap-0">
          <DataTable
            label={t("membership.bySector")}
            rows={r.bySector}
            rowKey={(s) => s.key}
            defaultSort={{ column: "count", direction: "descending" }}
            empty={<EmptyBlock size="sm" icon="Briefcase" title={t("membership.noSector")} />}
            columns={[
              {
                id: "label",
                header: t("common.sector"),
                isRowHeader: true,
                sortValue: (s) => s.label,
                cell: (s) => s.label,
              },
              {
                id: "count",
                header: t("common.businesses"),
                align: "end",
                sortValue: (s) => s.count,
                cell: (s) => <span className="tabular">{formatNumber(s.count)}</span>,
              },
              {
                id: "fees",
                header: view === "ours" ? t("common.ourRevenue") : t("common.allFees"),
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
        <SectionCard title={t("membership.byDistrict")} contentClassName="gap-0">
          <DataTable
            label={t("membership.byDistrict")}
            rows={r.districts}
            rowKey={(d) => String(d.districtId)}
            defaultSort={{ column: "members", direction: "descending" }}
            columns={[
              {
                id: "name",
                header: t("common.district"),
                isRowHeader: true,
                sortValue: (d) => d.name,
                cell: (d) => d.name,
              },
              {
                id: "waiting",
                header: t("common.waiting"),
                align: "end",
                sortValue: (d) => d.waiting,
                cell: (d) => formatNumber(d.waiting),
              },
              {
                id: "overdue",
                header: t("common.overdue"),
                align: "end",
                sortValue: (d) => d.overdue,
                cell: (d) => formatNumber(d.overdue),
              },
              {
                id: "members",
                header: t("common.members"),
                align: "end",
                sortValue: (d) => d.members,
                cell: (d) => formatNumber(d.members),
              },
              {
                id: "fees-new",
                header: t("membership.feesNew"),
                align: "end",
                sortValue: (d) => amount(d.fees.application),
                cell: (d) => formatMoney(amount(d.fees.application)),
              },
              {
                id: "fees-renewal",
                header: t("membership.feesRenewals"),
                align: "end",
                sortValue: (d) => amount(d.fees.renewal),
                cell: (d) => formatMoney(amount(d.fees.renewal)),
              },
              {
                id: "fees-upgrade",
                header: t("membership.feesUpgrades"),
                align: "end",
                sortValue: (d) => amount(d.fees.upgrade),
                cell: (d) => formatMoney(amount(d.fees.upgrade)),
              },
              {
                id: "fees",
                header: view === "ours" ? t("common.ourRevenue") : t("common.allFees"),
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

function Approvals({ r }: { r: PsfReport }) {
  const t = useTranslations("psfReports");
  const periodBefore = t("common.periodBefore");
  const g = r.registrations;
  const days = (value: number | null) =>
    value === null
      ? "—"
      : value < 1
        ? t("common.underADay")
        : t("common.days", { count: Math.round(value) });
  const waitKpi = (id: string, value: number | null, from: string): KpiItem => {
    if (value === null)
      return {
        id,
        label: t("common.timeToDecide"),
        value: 0,
        format: "count",
        icon: "Clock",
        footnote: t("common.nothingDecided"),
      };
    const hours = value < 1;
    return {
      id,
      label: t("common.timeToDecide"),
      value: hours ? Math.max(1, Math.round(value * 24)) : Math.round(value * 10) / 10,
      format: "count",
      icon: "Clock",
      footnote: `${hours ? t("common.medianHours") : t("common.medianDays")}, ${from}`,
    };
  };
  const statusWord = (status: string): string => {
    const words: Record<string, string> = {
      active: t("approvals.status.open"),
      approved: t("approvals.status.approved"),
      rejected: t("approvals.status.rejected"),
      suspended: t("approvals.status.suspended"),
      submitted: t("approvals.status.submitted"),
      tin_verified: t("approvals.status.submitted"),
      field_verified: t("approvals.status.fieldVerified"),
    };
    return words[status] ?? status;
  };
  return (
    <>
      <KpiStrip
        label={t("approvals.title")}
        items={[
          {
            id: "waiting",
            label: t("approvals.toReview"),
            value: g.waitingReview,
            format: "count",
            icon: "ShieldCheck",
            status: g.waitingReview > 0 ? "warning" : undefined,
            footnote: g.waitingReview ? t("approvals.reviewThem") : t("overview.noneWaiting"),
            href: "/officer",
          },
          {
            id: "approved",
            label: t("common.approved"),
            value: g.approvedInPeriod.value,
            format: "count",
            icon: "CircleCheck",
            trend: trend(g.approvedInPeriod, "up", periodBefore),
          },
          {
            id: "rejected",
            label: t("common.rejected"),
            value: g.rejectedInPeriod.value,
            format: "count",
            icon: "FileCheck",
            trend: trend(g.rejectedInPeriod, "down", periodBefore),
          },
          waitKpi("days", g.medianDaysToDecision, t("approvals.fromFee")),
          {
            id: "unpaid",
            label: t("approvals.feeNotPaid"),
            value: g.waitingPayment,
            format: "count",
            icon: "Wallet",
            footnote: t("approvals.startedNotReview"),
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title={t("approvals.registrationsByMonth")}
          description={t("approvals.registrationsByMonthLead")}
          rows={g.months}
          series={[
            { key: "submitted", label: t("common.feesPaid") },
            { key: "approved", label: t("common.approved") },
            { key: "rejected", label: t("common.rejected") },
          ]}
          noun={t("common.overTwelveMonths")}
          empty={t("approvals.noRegistration")}
        />
        <CountDonut
          title={t("approvals.whereStands")}
          description={t("common.today")}
          totalLabel={t("membership.totalBusinessesLabel")}
          noun={t("membership.businessNoun")}
          data={[
            { key: "review", label: t("approvals.status.submitted"), count: g.waitingReview },
            { key: "approval", label: t("approvals.status.fieldVerified"), count: g.waitingApproval },
            { key: "open", label: t("approvals.status.open"), count: g.active },
            { key: "rejected", label: t("approvals.status.rejected"), count: g.rejected },
            { key: "suspended", label: t("approvals.status.suspended"), count: g.suspended },
          ]}
          empty={{ icon: "ShieldCheck", title: t("approvals.noRegistrationYet") }}
        />
      </div>
      <SectionCard
        title={t("approvals.decidedInPeriod")}
        description={t("approvals.decidedInPeriodLead")}
        contentClassName="gap-0"
      >
        <DataTable
          label={t("approvals.decidedInPeriod")}
          rows={g.decided}
          rowKey={(d) => `${d.orgId}-${d.decidedAt}`}
          defaultSort={{ column: "when", direction: "descending" }}
          empty={<EmptyBlock size="sm" icon="ShieldCheck" title={t("approvals.noDecided")} />}
          columns={[
            {
              id: "name",
              header: t("common.business"),
              isRowHeader: true,
              sortValue: (d) => d.legalName,
              cell: (d) => (
                <NextLink href={businessHref(d.orgId)} className="font-medium text-foreground hover:underline">
                  {d.legalName}
                </NextLink>
              ),
            },
            { id: "kind", header: t("common.kind"), sortValue: (d) => d.kindLabel, cell: (d) => d.kindLabel },
            {
              id: "decision",
              header: t("common.decision"),
              sortValue: (d) => d.decision,
              cell: (d) => (
                <StatusChip tone={d.decision === "approved" ? "success" : "danger"}>
                  {d.decision === "approved" ? t("common.approved") : t("common.rejected")}
                </StatusChip>
              ),
            },
            {
              id: "by",
              header: t("common.decidedBy"),
              sortValue: (d) => d.decidedBy ?? "",
              cell: (d) => d.decidedBy ?? "—",
            },
            {
              id: "when",
              header: t("common.date"),
              sortValue: (d) => d.decidedAt,
              cell: (d) => formatDay(d.decidedAt),
            },
            {
              id: "now",
              header: t("common.now"),
              sortValue: (d) => d.status,
              cell: (d) => statusWord(d.status),
            },
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
                {d.decision === "approved" ? t("common.approved") : t("common.rejected")}
              </StatusChip>
            ),
          }}
        />
      </SectionCard>
    </>
  );
}

function Economy({ r }: { r: PsfReport }) {
  const t = useTranslations("psfReports");
  const periodBefore = t("common.periodBefore");
  const e = r.economy;
  const open = e.activeBusinesses.reduce((n, b) => n + b.count, 0);
  return (
    <>
      <KpiStrip
        label={t("economy.title")}
        items={[
          {
            id: "open",
            label: t("economy.openBusinesses"),
            value: open,
            format: "count",
            icon: "House",
            footnote: t("economy.approvedOnInjishi"),
          },
          {
            id: "bookings",
            label: t("economy.bookingsArriving"),
            value: e.bookings.value,
            format: "count",
            icon: "Calendar",
            trend: trend(e.bookings, "up", periodBefore),
          },
          {
            id: "nights",
            label: t("common.guestNights"),
            value: e.guestNights.value,
            format: "count",
            icon: "Persons",
            trend: trend(e.guestNights, "up", periodBefore),
          },
          {
            id: "value",
            label: t("common.bookedValue"),
            value: e.bookedValueRwf.value,
            format: "money",
            icon: "Wallet",
            trend: trend(e.bookedValueRwf, "up", periodBefore),
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title={t("economy.staysByMonth")}
          description={t("economy.staysByMonthLead")}
          rows={e.months}
          series={[
            { key: "bookings", label: t("common.bookings") },
            { key: "guestNights", label: t("common.guestNights") },
          ]}
          noun={t("common.overTwelveMonths")}
          empty={t("economy.noStayBooked")}
        />
        <CountDonut
          title={t("economy.openByKind")}
          description={t("common.today")}
          totalLabel={t("economy.totalBusinessesLabel")}
          noun={t("economy.businessNoun")}
          data={e.activeBusinesses.map((b) => ({ key: b.key, label: b.label, count: b.count }))}
          empty={{ icon: "House", title: t("economy.noBusinessOpen") }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MoneyArea
          className="lg:col-span-2"
          title={t("economy.valueByMonth")}
          description={t("economy.valueByMonthLead")}
          rows={e.months.map((m) => ({ month: m.month, value: m.valueRwf }))}
          empty={t("economy.noStayBooked")}
        />
        <SectionCard title={t("economy.sellingMost")} description={t("economy.inPeriod")} contentClassName="gap-0">
          {e.topBusinesses.length === 0 ? (
            <EmptyBlock size="sm" icon="House" title={t("economy.noStayThisPeriod")} />
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
                      {t("economy.bookingLine", {
                        bookings: formatNumber(b.bookings),
                        nights: formatNumber(b.guestNights),
                      })}
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
  const t = useTranslations("psfReports");
  const n = r.now;
  const windows = [
    { month: "0", label: t("members.within30"), count: n.expiringIn30Days },
    { month: "1", label: t("members.days31to60"), count: Math.max(0, n.expiringIn60Days - n.expiringIn30Days) },
    { month: "2", label: t("members.days61to90"), count: Math.max(0, n.expiringIn90Days - n.expiringIn60Days) },
  ];
  return (
    <>
      <KpiStrip
        label={t("members.title")}
        items={[
          {
            id: "members",
            label: t("members.memberLabel"),
            value: n.members,
            format: "count",
            icon: "Persons",
            href: "/psf/register?standing=member",
          },
          {
            id: "unpaid",
            label: t("members.approvedNotPaid"),
            value: n.awaitingPayment,
            format: "count",
            icon: "Wallet",
            footnote: t("members.membersOnceTheyPay"),
          },
          {
            id: "renew",
            label: t("members.renewIn30"),
            value: n.expiringIn30Days,
            format: "count",
            icon: "Clock",
            status: n.expiringIn30Days > 0 ? "warning" : undefined,
          },
          {
            id: "lapsed",
            label: t("members.lapsed"),
            value: n.lapsed,
            format: "count",
            icon: "Calendar",
            status: n.lapsed > 0 ? "danger" : undefined,
            footnote: t("members.pastEndNotRenewed"),
            href: "/psf/register?standing=lapsed",
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={t("members.renewalsAhead")}
          description={t("members.renewalsAheadLead")}
          isEmpty={n.expiringIn90Days === 0}
          empty={{ icon: "Calendar", title: t("members.noMembershipEnds") }}
          summary={t("members.renewalsSummary", {
            total: formatNumber(n.expiringIn90Days),
            soon: formatNumber(n.expiringIn30Days),
          })}
          table={{
            columns: [t("members.window"), t("members.memberships")],
            rows: windows.map((w) => [w.label, formatNumber(w.count)]),
          }}
        >
          <BarChart data={windows} height={220} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <BarChart.Grid vertical={false} />
            <BarChart.XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <BarChart.YAxis {...AXES.y} />
            <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
            <BarChart.Bar
              dataKey="count"
              name={t("members.memberships")}
              fill={CHART_COLOR.cat(1)}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartCard>
        <CountDonut
          title={t("members.standing")}
          description={t("members.standingLead")}
          totalLabel={t("members.totalBusinessesLabel")}
          noun={t("members.businessNoun")}
          data={[
            { key: "member", label: t("members.memberLabel"), count: n.members },
            { key: "unpaid", label: t("members.approvedNotPaidShort"), count: n.awaitingPayment },
            { key: "waiting", label: t("members.waitingOnPsf"), count: n.waiting },
            { key: "lapsed", label: t("members.lapsed"), count: n.lapsed },
          ]}
          empty={{ icon: "Persons", title: t("members.noBusinessWithPsf") }}
        />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <MonthBars
          className="lg:col-span-2"
          title={t("members.newByMonth")}
          description={t("members.newByMonthLead")}
          rows={barMonths(r)}
          series={[{ key: "members", label: t("common.newMembers") }]}
          noun={t("common.overTwelveMonths")}
          empty={t("members.noMembershipBegan")}
        />
        <CountDonut
          title={t("membership.membersByTier")}
          description={t("common.today")}
          totalLabel={t("members.memberLabel")}
          noun={t("members.memberNoun")}
          data={tierSlices(r, t("common.noTier"))}
          empty={{ icon: "Persons", title: t("membership.noMemberYet") }}
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
  const t = useTranslations("psfReports");
  const meta = useReportMeta();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = meta[id];
  const period = periodFromRange(report.from, report.to, today);
  const span = t("common.range", { from: formatDay(report.from), to: formatDay(report.to) });
  // Every part of the report, as CSV, Excel, PDF or Word (2026-11-02).
  const exportRows = async (): Promise<ExportTable> => ({
    filename: `psf-${id}-${report.from}-to-${report.to}`,
    title: `PSF · ${current.title}`,
    subtitle: `${report.regionLabel}, ${span} · ${scope.title}`,
    sections: csvFor(id, report).map((sec) => ({ title: sec.title, heading: sec.columns, rows: sec.rows })),
  });
  return (
    <div data-print-root="">
      <PageContent>
        <PageHeader
          eyebrow={`${scope.title} · ${report.regionLabel}`}
          title={current.title}
          description={`${current.blurb} ${span}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <ExportMenu load={exportRows} />
              <ActionButton icon="Printer" intent="primary" onPress={() => window.print()}>
                {t("common.print")}
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
            label={t("common.reportPeriod")}
          />
          <span className="text-xs text-muted">{t("common.periodNote")}</span>
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
