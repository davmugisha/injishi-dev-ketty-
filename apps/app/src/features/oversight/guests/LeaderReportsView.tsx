"use client";

import { Card } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import type { GuestReport, LeaderSummary } from "@injishi/contracts";
import {
  ActionLink,
  CHART_COLOR,
  ChartCard,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  formatNumber,
  KpiStrip,
  PageContent,
  PageHeader,
  type Period,
  PeriodPicker,
  periodFromRange,
  SectionCard,
  SelectField,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { scopeLine } from "./LeaderGuestsView";

type OriginFilter = "all" | "nationals" | "international";


const AREA_WORD = { sector: "Sector", cell: "Cell", village: "Village" } as const;

/** A ranked list with a bar per row: nationalities, relationships. */
function RankedBars({ rows, total }: { rows: { key: string; label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="text-xs text-muted tabular">{total > 0 ? Math.round((r.count / total) * 100) : 0}%</span>
            <span className="w-10 text-right font-medium tabular">{formatNumber(r.count)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-default">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, background: CHART_COLOR.cat(1) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ArrivalsChart({ report, className }: { report: GuestReport; className?: string }) {
  const points = report.arrivals.points;
  const total = points.reduce((n, p) => n + p.count, 0);
  const busiest = points.reduce((best, p) => (p.count > (best?.count ?? -1) ? p : best), points[0]);
  const per = report.arrivals.bucket === "day" ? "day" : report.arrivals.bucket === "week" ? "week" : "month";
  return (
    <ChartCard
      className={className}
      title="Arrivals"
      description={`Guests arriving per ${per}`}
      isEmpty={total === 0}
      empty={{ icon: "Calendar", title: "Nobody arrived in this period" }}
      summary={`${formatNumber(total)} guests arrived. The busiest ${per} was ${busiest?.label ?? ""} with ${formatNumber(busiest?.count ?? 0)}.`}
      table={{
        columns: [per === "day" ? "Day" : per === "week" ? "Week of" : "Month", "Guests"],
        rows: points.map((p) => [p.label, formatNumber(p.count)]),
      }}
    >
      <BarChart data={points} height={240} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <BarChart.Grid vertical={false} />
        <BarChart.XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <BarChart.YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <BarChart.Tooltip cursor={{ fill: "var(--default)", opacity: 0.6 }} content={<BarChart.TooltipContent />} />
        <BarChart.Bar dataKey="count" name="Guests" fill={CHART_COLOR.cat(1)} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartCard>
  );
}

/**
 * The local leader's reports (P5): for a period and, when the post covers more than one place, a sector,
 * cell or village in it: how many guests arrived, are staying now, came from abroad and were flagged, the
 * average stay, arrivals over time, where in the area, nationalities, relationships, and the homes with
 * the most guests (by address, never by person). Downloads as CSV, or one page in PDF with the leader's
 * name and the period, to send up the chain.
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
  downloads: { csv: string; pdf: string };
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
  const period: Period = periodFromRange(report.period.from, report.period.to, today);
  const { filters, counts } = summary;
  const t = report.totals;
  const sectorId = params.get("sectorId");
  const cellId = params.get("cellId");
  const villageId = params.get("villageId");
  const origin = (params.get("origin") as OriginFilter | null) ?? "all";
  const nationalityRows = useMemo(() => {
    if (origin === "nationals") return report.byNationality.filter((n) => n.code.toUpperCase() === "RW");
    if (origin === "international") return report.byNationality.filter((n) => n.code.toUpperCase() !== "RW");
    return report.byNationality;
  }, [origin, report.byNationality]);
  const totalNationality = nationalityRows.reduce((n, r) => n + r.count, 0);
  const nationalsCount = report.byNationality
    .filter((n) => n.code.toUpperCase() === "RW")
    .reduce((n, r) => n + r.count, 0);
  const internationalCount = Math.max(0, t.registered - nationalsCount);
  const totalRelationship = report.byRelationship.reduce((n, r) => n + r.count, 0);
  const span = `${formatDay(report.period.from)} to ${formatDay(report.period.to)}`;
  const areaRows =
    origin === "all"
      ? report.byArea
      : report.byArea.map((a) => ({
          ...a,
          registered: origin === "international" ? a.fromAbroad : Math.max(0, a.registered - a.fromAbroad),
          fromAbroad: origin === "international" ? a.fromAbroad : 0,
        }));

  return (
    <PageContent>
      <PageHeader
        title="Guest reports"
        description={scopeLine(summary)}
        actions={
          <>
            <ActionLink href={downloads.csv} icon="ArrowDownToLine" prefetch={false}>
              CSV
            </ActionLink>
            <ActionLink href={downloads.pdf} icon="FileArrowDown" intent="primary" prefetch={false}>
              One-page PDF
            </ActionLink>
          </>
        }
      />

      <FilterTabs
        label="Guests"
        selectedKey="reports"
        onSelectionChange={(key) => (key === "reports" ? undefined : router.push(`/officer/guests?tab=${key}`))}
        tabs={[
          { id: "arriving", label: "Arriving", count: counts.arriving },
          { id: "staying", label: "Staying now", count: counts.staying },
          { id: "left", label: "Left", count: counts.left },
          { id: "flagged", label: "Flagged", count: counts.flagged },
          { id: "reports", label: "Reports" },
        ]}
      />

      <Card className="min-w-0 flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodPicker
            value={period}
            today={today}
            allowFuture
            maxDays={731}
            onChange={(p) => go({ from: p.start, to: p.end })}
            label="Report period"
          />
          {filters.sectors.length > 0 ? (
            <SelectField
              label="Sector"
              className="w-full sm:w-44"
              value={sectorId}
              placeholder="All sectors"
              options={[
                { id: "", label: "All sectors" },
                ...filters.sectors.map((s) => ({ id: String(s.id), label: s.name })),
              ]}
              onChange={(v) => go({ sectorId: v || null, cellId: null, villageId: null })}
            />
          ) : null}
          {filters.cells.length > 0 ? (
            <SelectField
              label="Cell"
              className="w-full sm:w-44"
              value={cellId}
              placeholder="All cells"
              options={[
                { id: "", label: "All cells" },
                ...filters.cells.map((c) => ({ id: String(c.id), label: c.name })),
              ]}
              onChange={(v) => go({ cellId: v || null, villageId: null })}
            />
          ) : null}
          {filters.villages.length > 0 ? (
            <SelectField
              label="Village"
              className="w-full sm:w-44"
              value={villageId}
              placeholder="All villages"
              options={[
                { id: "", label: "All villages" },
                ...filters.villages.map((v) => ({ id: String(v.id), label: v.name })),
              ]}
              onChange={(v) => go({ villageId: v || null })}
            />
          ) : null}
        </div>
        <Segment
          aria-label="Guest origin"
          selectedKey={origin}
          onSelectionChange={(key) =>
            go({ origin: key === "all" ? null : String(key) })
          }
          className="w-fit"
        >
          <Segment.Item id="all">All guests</Segment.Item>
          <Segment.Item id="nationals">Nationals</Segment.Item>
          <Segment.Item id="international">International</Segment.Item>
        </Segment>
      </Card>

      <KpiStrip
        label={`Guests, ${span}`}
        items={[
          {
            id: "registered",
            label: origin === "nationals" ? "Nationals" : origin === "international" ? "International" : "Registered",
            value:
              origin === "nationals" ? nationalsCount : origin === "international" ? internationalCount : t.registered,
            format: "count",
            icon: "PersonPlus",
            footnote: "Arriving in the period",
          },
          {
            id: "staying",
            label: "Staying now",
            value: t.stayingNow,
            format: "count",
            icon: "House",
            footnote: "Today",
          },
          { id: "abroad", label: "Foreign guests", value: t.fromAbroad, format: "count", icon: "Globe" },
          {
            id: "flagged",
            label: "Flagged",
            value: t.flagged,
            format: "count",
            icon: "Flag",
            status: t.flagged > 0 ? "danger" : undefined,
          },
          {
            id: "nights",
            label: "Average stay",
            value: t.averageNights ?? 0,
            format: "count",
            icon: "Clock",
            footnote: t.averageNights === null ? "No stays yet" : "Nights",
          },
        ]}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <ArrivalsChart report={report} className="lg:col-span-2" />
        <SectionCard title="Nationalities" description={span} className="lg:col-span-1">
          {nationalityRows.length === 0 ? (
            <EmptyBlock size="sm" icon="Globe" title="No guests in this view" />
          ) : (
            <RankedBars
              total={totalNationality}
              rows={nationalityRows.map((n) => ({ key: n.code, label: n.name, count: n.count }))}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <SectionCard
          title={`By ${AREA_WORD[report.areaLevel].toLowerCase()}`}
          className="lg:col-span-2"
          contentClassName="gap-0"
        >
          <DataTable
            label={`Guests by ${AREA_WORD[report.areaLevel].toLowerCase()}`}
            rows={areaRows}
            rowKey={(a) => String(a.id)}
            defaultSort={{ column: "registered", direction: "descending" }}
            empty={<EmptyBlock size="sm" icon="MapPin" title="No guests in this period" />}
            columns={[
              {
                id: "name",
                header: AREA_WORD[report.areaLevel],
                isRowHeader: true,
                sortValue: (a) => a.name,
                cell: (a) => a.name,
              },
              {
                id: "registered",
                header: "Guests",
                align: "end",
                sortValue: (a) => a.registered,
                cell: (a) => <span className="tabular">{formatNumber(a.registered)}</span>,
              },
              {
                id: "abroad",
                header: "Foreign",
                align: "end",
                sortValue: (a) => a.fromAbroad,
                cell: (a) => <span className="tabular">{formatNumber(a.fromAbroad)}</span>,
              },
              {
                id: "flagged",
                header: "Flagged",
                align: "end",
                sortValue: (a) => a.flagged,
                cell: (a) => <span className="tabular">{formatNumber(a.flagged)}</span>,
              },
            ]}
            mobile={{
              title: (a) => a.name,
              description: (a) => `${formatNumber(a.fromAbroad)} from abroad · ${formatNumber(a.flagged)} flagged`,
              trailing: (a) => <span className="font-medium tabular">{formatNumber(a.registered)}</span>,
            }}
          />
        </SectionCard>
        <SectionCard title="Who they are to their hosts">
          {report.byRelationship.length === 0 ? (
            <EmptyBlock size="sm" icon="Persons" title="No guests in this period" />
          ) : (
            <RankedBars
              total={totalRelationship}
              rows={report.byRelationship.map((r) => ({ key: r.code, label: r.label, count: r.count }))}
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Homes with the most guests"
        description="By address, never by who lives there"
        contentClassName="gap-0"
      >
        <DataTable
          label="Homes with the most guests"
          rows={report.topHomes}
          rowKey={(h) => `${h.address}|${h.unitLabel ?? ""}`}
          empty={<EmptyBlock size="sm" icon="House" title="No guests in this period" />}
          columns={[
            {
              id: "address",
              header: "Address",
              isRowHeader: true,
              cell: (h) => <span className="whitespace-normal">{h.address}</span>,
            },
            { id: "unit", header: "Unit", cell: (h) => h.unitLabel ?? "Whole building" },
            {
              id: "guests",
              header: "Guests",
              align: "end",
              cell: (h) => <span className="tabular">{formatNumber(h.guests)}</span>,
            },
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
