"use client";

import { Button, Tooltip } from "@heroui/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import type { GuestReport, LeaderSummary } from "@injishi/contracts";
import {
  ActionButton,
  CHART_COLOR,
  ChartCard,
  DataTable,
  EmptyBlock,
  formatDay,
  formatNumber,
  Icon,
  KpiStrip,
  PageContent,
  type Period,
  PeriodPicker,
  periodFromRange,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { DownloadMenu } from "./DownloadMenu";
import { AREA_KEYS, GUEST_FILTER_KEYS, GuestFilters, withFlag } from "./GuestFilters";

const AREA_WORD = { sector: "Sector", cell: "Cell", village: "Village" } as const;

/** A chart's short title, with the question it answers in a tooltip. */
function Titled({ title, help }: { title: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {title}
      <Tooltip delay={200} closeDelay={0}>
        <Button isIconOnly size="sm" variant="ghost" aria-label={`About ${title}`} className="size-6 min-w-6">
          <Icon name="CircleInfo" className="size-3.5 text-muted" />
        </Button>
        <Tooltip.Content showArrow placement="top" className="max-w-64">
          {help}
        </Tooltip.Content>
      </Tooltip>
    </span>
  );
}

/** A ranked list with a bar per row; pressing a row filters the whole report to it. */
function RankedBars({
  rows,
  selected,
  onPick,
  what,
}: {
  rows: { key: string; label: string; count: number; note?: string }[];
  /** The row the report is filtered to, if any. */
  selected?: string | null;
  onPick?: (key: string | null) => void;
  /** "nationality", for the rows' accessible names. */
  what: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <ul className="-mx-2 flex flex-col gap-0.5">
      {rows.map((r) => {
        const on = selected === r.key;
        const body = (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className={`min-w-0 flex-1 truncate ${on ? "font-semibold" : ""}`}>{r.label}</span>
              {r.note ? <span className="text-xs text-muted">{r.note}</span> : null}
              <span className="text-xs text-muted tabular">{total > 0 ? Math.round((r.count / total) * 100) : 0}%</span>
              <span className="w-10 text-right font-medium tabular">{formatNumber(r.count)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-default">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.count / max) * 100}%`, background: CHART_COLOR.cat(1) }}
              />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {onPick ? (
              <button
                type="button"
                aria-pressed={on}
                aria-label={on ? `Show every ${what}` : `Show only ${r.label}`}
                onClick={() => onPick(on ? null : r.key)}
                className={`flex w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-default/60 ${on ? "bg-accent-soft" : ""}`}
              >
                {body}
              </button>
            ) : (
              <div className="flex flex-col gap-1 px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A card of ranked rows, with its question in a tooltip and an empty state. */
function RankedCard({
  title,
  help,
  empty,
  className,
  children,
}: {
  title: string;
  help: string;
  empty: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SectionCard title={<Titled title={title} help={help} />} className={className}>
      {empty ? <EmptyBlock size="sm" icon="ChartColumn" title="No guests in this view" /> : children}
    </SectionCard>
  );
}

/**
 * Who was here each day, whenever they arrived: the load on the area, not only the arrivals. Local
 * government sees Rwandan and foreign guests stacked; DGIE one bar, all from abroad.
 */
function PresentChart({ report, className }: { report: GuestReport; className?: string }) {
  const dgie = report.audience === "dgie";
  const points = (report.presentByDay ?? []).map((d) => ({ ...d, rwandan: d.total - d.fromAbroad }));
  const peak = points.reduce<(typeof points)[number] | null>(
    (best, p) => (p.total > (best?.total ?? -1) ? p : best),
    null,
  );
  const nobody = !peak || peak.total === 0;
  return (
    <ChartCard
      className={className}
      title={
        <Titled
          title="Guests present each day"
          help="Everyone staying in the area on the day: arrived on or before it and not yet gone, whenever they arrived."
        />
      }
      description={nobody ? undefined : `Most on one day: ${formatNumber(peak.total)}, on ${peak.label}`}
      legend={
        dgie
          ? undefined
          : [
              { label: "Rwandan", color: CHART_COLOR.cat(1) },
              { label: "Foreign", color: CHART_COLOR.cat(2) },
            ]
      }
      isEmpty={nobody}
      empty={{ icon: "Calendar", title: "Nobody stayed in this period" }}
      summary={
        nobody
          ? "Nobody stayed in this period."
          : `At most ${peak.total} guests were here on one day, on ${peak.label}.`
      }
      table={{
        columns: dgie ? ["Day", "Guests"] : ["Day", "Rwandan", "Foreign", "All"],
        rows: points.map((p) =>
          dgie
            ? [p.label, formatNumber(p.total)]
            : [p.label, formatNumber(p.rwandan), formatNumber(p.fromAbroad), formatNumber(p.total)],
        ),
      }}
    >
      <BarChart data={points} height={240} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <BarChart.Grid vertical={false} />
        <BarChart.XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <BarChart.YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
        {dgie ? (
          <BarChart.Bar dataKey="total" name="Guests" fill={CHART_COLOR.cat(1)} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ) : (
          <>
            <BarChart.Bar dataKey="rwandan" name="Rwandan" stackId="g" fill={CHART_COLOR.cat(1)} maxBarSize={28} />
            <BarChart.Bar
              dataKey="fromAbroad"
              name="Foreign"
              stackId="g"
              fill={CHART_COLOR.cat(2)}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </>
        )}
      </BarChart>
    </ChartCard>
  );
}

/** How long stays are, in bands, with the mean in the description. */
function StayChart({ report, className }: { report: GuestReport; className?: string }) {
  // Short axis words, the band's full words in the tooltip's table view.
  const AXIS: Record<string, string> = { same_day: "0", short: "1-2", days: "3-6", weeks: "7-29", month: "30+" };
  const bands = (report.stayBands ?? []).map((b) => ({ ...b, axis: AXIS[b.band] ?? b.label }));
  const total = bands.reduce((n, b) => n + b.count, 0);
  const avg = report.totals.averageNights;
  return (
    <ChartCard
      className={className}
      title={
        <Titled
          title="How long guests stay"
          help="Nights from arrival to departure, for the guests who arrived in the period."
        />
      }
      description={avg === null ? "Nights per stay" : `Nights per stay, ${avg} on average`}
      isEmpty={total === 0}
      empty={{ icon: "Clock", title: "No stays in this period" }}
      summary={`${bands.map((b) => `${b.label}: ${b.count}`).join(", ")}. Average ${avg ?? 0} nights.`}
      table={{ columns: ["Length", "Guests"], rows: bands.map((b) => [b.label, formatNumber(b.count)]) }}
    >
      <BarChart data={bands} height={200} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <BarChart.Grid vertical={false} />
        <BarChart.XAxis dataKey="axis" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <BarChart.YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
        <BarChart.Bar dataKey="count" name="Guests" fill={CHART_COLOR.cat(1)} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ChartCard>
  );
}

/**
 * Who received the period's guests and what they did, post by post in the chain's order: each body its own
 * posts (local government's village, cell and district; DGIE's village, cell and district).
 */
function ChainCard({ report, className }: { report: GuestReport; className?: string }) {
  const rows = report.chain ?? [];
  return (
    <SectionCard
      title={
        <Titled
          title="Opened along the chain"
          help="For each post the period's guests went to: how many it received and opened, and any that wait because nobody holds the post."
        />
      }
      className={className}
      contentClassName="gap-0"
    >
      {rows.length === 0 ? (
        <EmptyBlock size="sm" icon="Persons" title="No guests in this view" />
      ) : (
        <ol className="flex flex-col">
          {rows.map((c, i) => {
            const opened = c.guests > 0 ? Math.round((c.opened / c.guests) * 100) : 0;
            const last = i === rows.length - 1;
            const tone = c.waiting === c.guests ? "warning" : c.opened === c.guests ? "success" : "accent";
            return (
              <li key={c.role} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular ${
                      tone === "success"
                        ? "bg-success-soft text-success"
                        : tone === "warning"
                          ? "bg-warning-soft text-warning"
                          : "bg-accent-soft text-accent"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {last ? null : <span aria-hidden className="w-px flex-1 bg-separator" />}
                </div>
                <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${last ? "" : "pb-4"}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 text-sm font-medium">{c.label}</span>
                    {c.flagged > 0 ? (
                      <StatusChip tone="danger">{`${formatNumber(c.flagged)} flagged`}</StatusChip>
                    ) : null}
                    {c.waiting > 0 ? (
                      <StatusChip tone="warning">
                        {c.waiting === c.guests
                          ? "No leader appointed"
                          : `${formatNumber(c.waiting)} wait for a leader`}
                      </StatusChip>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-default">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${opened}%`, background: CHART_COLOR.cat(1) }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted tabular">
                      {formatNumber(c.opened)} of {formatNumber(c.guests)} opened
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

/**
 * The leader's reports (P5, 2026-11-02): for a period of arrivals and the filters in one toolbar row, each
 * chart answering one question, with its title and a tooltip saying what it counts. Local government sees
 * Rwandan and foreign guests side by side, by area and relationship; DGIE sees guests from abroad, by
 * nationality first. Downloads (Excel, PDF, CSV) carry the same filters.
 */
export function LeaderReportsView({
  report,
  summary,
  today,
  downloads,
}: {
  report: GuestReport;
  summary: LeaderSummary;
  today: string;
  downloads: { xlsx: string; csv: string; pdf: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const dgie = (report.audience ?? summary.audience) === "dgie";
  const period: Period = periodFromRange(report.period.from, report.period.to, today);
  const t = report.totals;
  const span = `${formatDay(report.period.from)} to ${formatDay(report.period.to)}`;
  const guestsHref = (tab: string) => `/officer/guests?tab=${tab}`;
  const foreignShare = t.registered > 0 ? Math.round((t.fromAbroad / t.registered) * 100) : 0;
  const choices = report.choices ?? { nationalities: [], relationships: [] };
  const filtered = [...GUEST_FILTER_KEYS, ...AREA_KEYS].some((k) => params.get(k));
  const clearAction = filtered ? (
    <ActionButton
      size="sm"
      icon="Xmark"
      onPress={() => go(Object.fromEntries([...GUEST_FILTER_KEYS, ...AREA_KEYS].map((k) => [k, null])))}
    >
      Clear filters
    </ActionButton>
  ) : undefined;

  const nationalityRows = report.byNationality
    .filter((n) => !dgie || n.code !== "RW")
    .map((n) => ({ key: n.code, label: n.code === "other" ? n.name : withFlag(n.code, n.name), count: n.count }));
  const placeRows = (report.byPlaceType ?? []).map((p) => ({
    key: p.type,
    label: p.label,
    count: p.count,
    note: [
      dgie ? null : `${formatNumber(p.fromAbroad)} foreign`,
      p.averageNights === null ? null : `${p.averageNights} nights avg`,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const timingRows = (report.timing ?? []).map((x) => ({ key: x.timing, label: x.label, count: x.count }));

  const kpis = dgie
    ? [
        {
          id: "registered",
          label: "Foreign guests",
          value: t.registered,
          format: "count" as const,
          icon: "Passport" as const,
          footnote: "Arrived in the period",
        },
        {
          id: "nations",
          label: "Nationalities",
          value: t.nationalities ?? 0,
          format: "count" as const,
          icon: "Globe" as const,
          footnote: "Among them",
        },
        {
          id: "staying",
          label: "Staying now",
          value: t.stayingNow,
          format: "count" as const,
          icon: "House" as const,
          footnote: "Today",
          href: guestsHref("staying"),
        },
        {
          id: "nights",
          label: "Average stay",
          value: t.averageNights ?? 0,
          format: "count" as const,
          icon: "Clock" as const,
          footnote: t.averageNights === null ? "No stays yet" : "Nights",
        },
        {
          id: "flagged",
          label: "Flagged",
          value: t.flagged,
          format: "count" as const,
          icon: "Flag" as const,
          status: t.flagged > 0 ? ("danger" as const) : undefined,
          footnote: t.flagged > 0 ? "Open the flagged list" : "None flagged",
          href: guestsHref("flagged"),
        },
      ]
    : [
        {
          id: "rwandan",
          label: "Rwandan",
          value: t.nationals ?? t.registered - t.fromAbroad,
          format: "count" as const,
          icon: "Person" as const,
          footnote:
            t.registered > 0 ? `${100 - foreignShare}% of ${formatNumber(t.registered)} arrived` : "Nobody arrived",
        },
        {
          id: "abroad",
          label: "Foreign",
          value: t.fromAbroad,
          format: "count" as const,
          icon: "Globe" as const,
          footnote: t.registered > 0 ? `${foreignShare}% of ${formatNumber(t.registered)} arrived` : "Nobody arrived",
        },
        {
          id: "staying",
          label: "Staying now",
          value: t.stayingNow,
          format: "count" as const,
          icon: "House" as const,
          footnote: "Today",
          href: guestsHref("staying"),
        },
        {
          id: "nights",
          label: "Average stay",
          value: t.averageNights ?? 0,
          format: "count" as const,
          icon: "Clock" as const,
          footnote: t.averageNights === null ? "No stays yet" : "Nights",
        },
        {
          id: "flagged",
          label: "Flagged",
          value: t.flagged,
          format: "count" as const,
          icon: "Flag" as const,
          status: t.flagged > 0 ? ("danger" as const) : undefined,
          footnote: t.flagged > 0 ? "Open the flagged list" : "None flagged",
          href: guestsHref("flagged"),
        },
      ];

  const nationalities = (
    <RankedCard
      title={dgie ? "Top nationalities" : "Where guests are from"}
      help={
        dgie
          ? "Guests from abroad who arrived in the period, by nationality. Press one to filter the report to it."
          : "Guests who arrived in the period, by nationality. Press one to filter the report to it."
      }
      empty={nationalityRows.length === 0}
    >
      <RankedBars
        what="nationality"
        rows={nationalityRows}
        selected={params.get("nationality")}
        onPick={(code) => go({ nationality: code === "other" ? null : code, origin: null })}
      />
    </RankedCard>
  );
  const places = (
    <RankedCard
      title="Arrivals by type of place"
      help="Where the period's guests stayed: hotels, lodges, guest houses and apartments file at check in; a residence is a tenant's or landlord's home. Press one to filter."
      empty={placeRows.length === 0}
    >
      <RankedBars
        what="type of place"
        rows={placeRows}
        selected={params.get("placeType")}
        onPick={(type) => go({ placeType: type })}
      />
    </RankedCard>
  );
  const timing = (
    <RankedCard
      title="When guests were reported"
      help="The day each guest was reported, against their arrival: ahead, on the day (a hotel files at check in), or late."
      empty={timingRows.every((r) => r.count === 0)}
    >
      <RankedBars what="report timing" rows={timingRows} />
    </RankedCard>
  );

  return (
    <PageContent>
      <AreaHeader
        actions={
          <DownloadMenu
            intent="primary"
            files={[
              {
                id: "xlsx",
                label: "Excel (.xlsx)",
                description: "Every figure, then the guests and each day",
                href: downloads.xlsx,
                icon: "LayoutCells",
              },
              {
                id: "pdf",
                label: "PDF",
                description: "The summary to send up the chain",
                href: downloads.pdf,
                icon: "FileArrowDown",
              },
              {
                id: "csv",
                label: "CSV",
                description: "The figures, for another system",
                href: downloads.csv,
                icon: "FileText",
              },
            ]}
          />
        }
      />

      <GuestFilters
        mode="report"
        params={params}
        go={go}
        today={today}
        audience={dgie ? "dgie" : "local"}
        scopes={summary.scopes}
        filters={summary.filters}
        nationalities={choices.nationalities}
        relationships={choices.relationships}
        leading={
          <PeriodPicker
            value={period}
            today={today}
            allowFuture
            maxDays={731}
            onChange={(p) => go({ from: p.start, to: p.end })}
            label="Arrival period"
          />
        }
      />

      <KpiStrip label={`${dgie ? "Foreign guests" : "Guests"}, ${span}`} items={kpis} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <PresentChart report={report} className="lg:col-span-2" />
        {nationalities}
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        {places}
        <StayChart report={report} />
        {timing}
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <ChainCard report={report} className={dgie && report.byArea.length <= 1 ? "lg:col-span-3" : "lg:col-span-2"} />
        <div className="flex min-w-0 flex-col gap-4">
          {dgie ? null : (
            <RankedCard
              title="Who they are to their hosts"
              help="For guests of a residence, who they are to the tenant or landlord; a hotel's guests count as hotel guests. Press one to filter."
              empty={report.byRelationship.length === 0}
            >
              <RankedBars
                what="relationship"
                rows={report.byRelationship.map((r) => ({ key: r.code, label: r.label, count: r.count }))}
                selected={params.get("relationship")}
                onPick={(code) => go({ relationship: code })}
              />
            </RankedCard>
          )}
          {report.byArea.length > 1 ? (
            <RankedCard
              title={`Guests by ${AREA_WORD[report.areaLevel].toLowerCase()}`}
              help={`The period's arrivals in each ${AREA_WORD[report.areaLevel].toLowerCase()} of your area.`}
              empty={false}
            >
              <RankedBars
                what={AREA_WORD[report.areaLevel].toLowerCase()}
                rows={report.byArea.map((a) => ({
                  key: String(a.id),
                  label: a.name,
                  count: a.registered,
                  note: dgie ? undefined : `${formatNumber(a.fromAbroad)} foreign`,
                }))}
              />
            </RankedCard>
          ) : null}
        </div>
      </div>

      <SectionCard
        title={
          <Titled
            title="Places with the most guests"
            help="The hotels, lodges and homes the period's guests stayed at, by name and address, never by who lives there."
          />
        }
        contentClassName="gap-0"
      >
        <DataTable
          label="Places with the most guests"
          rows={report.topHomes}
          rowKey={(h) => `${h.name}|${h.address}|${h.unitLabel ?? ""}`}
          empty={<EmptyBlock size="sm" icon="House" title="No guests in this period" action={clearAction} />}
          columns={[
            {
              id: "place",
              header: "Place",
              isRowHeader: true,
              cell: (h) => (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate font-medium">
                    {h.unitLabel ? `${h.name || h.address}, unit ${h.unitLabel}` : h.name || h.address}
                  </span>
                  <span className="truncate text-xs text-muted">{h.address}</span>
                </div>
              ),
            },
            { id: "type", header: "Type of place", cell: (h) => h.placeLabel || "-" },
            {
              id: "guests",
              header: "Guests",
              align: "end",
              cell: (h) => <span className="tabular">{formatNumber(h.guests)}</span>,
            },
            ...(dgie
              ? []
              : [
                  {
                    id: "abroad",
                    header: "Foreign",
                    align: "end" as const,
                    cell: (h: GuestReport["topHomes"][number]) => (
                      <span className="tabular">{formatNumber(h.fromAbroad ?? 0)}</span>
                    ),
                  },
                ]),
          ]}
        />
      </SectionCard>

      {report.purged ? (
        <p className="text-xs text-muted">
          Guest records are deleted 12 months after the guest leaves. For arrivals before{" "}
          {formatDay(report.purged.before)}, the totals include {formatNumber(report.purged.registered)} guests kept as
          counts only.
        </p>
      ) : null}
    </PageContent>
  );
}
