"use client";

import { BarChart } from "@heroui-pro/react/bar-chart";
import type { GuestReport, LeaderSummary } from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  CHART_COLOR,
  ChartCard,
  CountDonut,
  DataTable,
  EmptyBlock,
  formatDay,
  formatNumber,
  KpiStrip,
  PageContent,
  type Period,
  PeriodPicker,
  periodFromRange,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { GuestFilters } from "./GuestFilters";


/** The guest filters the address carries; the period and the area are kept apart. */
const GUEST_FILTERS = ["origin", "nationality", "relationship", "flagged"] as const;

const AREA_WORD = { sector: "Sector", cell: "Cell", village: "Village" } as const;

/** A ranked list with a bar per row: nationalities, relationships. */
function RankedBars({
  rows,
  total,
  selected,
  onPick,
  what,
}: {
  rows: { key: string; label: string; count: number }[];
  total: number;
  /** The row the report is filtered to, if any. */
  selected?: string | null;
  /** Pressing a row filters the whole report to it; pressing the chosen row clears it. */
  onPick?: (key: string | null) => void;
  /** "nationality", for the rows' accessible names. */
  what: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="-mx-2 flex flex-col gap-0.5">
      {rows.map((r) => {
        const on = selected === r.key;
        const body = (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className={`min-w-0 flex-1 truncate ${on ? "font-semibold" : ""}`}>{r.label}</span>
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

function ArrivalsChart({ report, className }: { report: GuestReport; className?: string }) {
  const points = report.arrivals.points;
  const total = points.reduce((n, p) => n + p.count, 0);
  const busiest = points.reduce((best, p) => (p.count > (best?.count ?? -1) ? p : best), points[0]);
  const per = report.arrivals.bucket === "day" ? "day" : report.arrivals.bucket === "week" ? "week" : "month";
  return (
    <ChartCard
      className={className}
      title={`Arrivals (guests per ${per})`}
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
 * Who received the period's guests and what they did, post by post in the chain's order: the village
 * leader and the sector DASSO get every guest when it is filed, then the cell executive secretary, then
 * the district officer for Rwandans or the district immigration officer for foreign guests.
 */
function ChainCard({ report, className }: { report: GuestReport; className?: string }) {
  // An API a version behind sends no chain: show the card empty, never break the page.
  const rows = report.chain ?? [];
  return (
    <SectionCard title="Opened along the chain" className={className} contentClassName="gap-0">
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
                    {c.step}
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
  const { filters } = summary;
  const t = report.totals;
  const nationality = params.get("nationality");
  const relationship = params.get("relationship");
  const filtered = [...GUEST_FILTERS, "sectorId", "cellId", "villageId"].some((k) => params.get(k));
  const clearFilters = () =>
    go(Object.fromEntries([...GUEST_FILTERS, "sectorId", "cellId", "villageId"].map((k) => [k, null])));
  const clearAction = filtered ? (
    <ActionButton size="sm" icon="Xmark" onPress={clearFilters}>
      Clear filters
    </ActionButton>
  ) : undefined;
  // The report comes back filtered from the API, so every figure, chart and table below is the same view.
  const totalRelationship = report.byRelationship.reduce((n, r) => n + r.count, 0);
  const span = `${formatDay(report.period.from)} to ${formatDay(report.period.to)}`;
  const guestsHref = (tab: string) => `/officer/guests?tab=${tab}`;
  const foreignShare = t.registered > 0 ? Math.round((t.fromAbroad / t.registered) * 100) : 0;
  const choices = report.choices ?? { nationalities: [], relationships: [] };

  return (
    <PageContent>
      <AreaHeader
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

      <GuestFilters
        params={params}
        go={go}
        scopes={summary.scopes}
        filters={filters}
        nationalities={choices.nationalities}
        relationships={choices.relationships}
        flagged
        leading={
          <PeriodPicker
            value={period}
            today={today}
            allowFuture
            maxDays={731}
            onChange={(p) => go({ from: p.start, to: p.end })}
            label="Report period"
          />
        }
      />

      <KpiStrip
        label={`Guests, ${span}`}
        items={[
          {
            id: "registered",
            label: "Registered",
            value: t.registered,
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
            href: guestsHref("staying"),
          },
          {
            id: "abroad",
            label: "Foreign guests",
            value: t.fromAbroad,
            format: "count",
            icon: "Globe",
            footnote: t.registered > 0 ? `${foreignShare}% of guests` : "None in the period",
          },
          {
            id: "flagged",
            label: "Flagged",
            value: t.flagged,
            format: "count",
            icon: "Flag",
            status: t.flagged > 0 ? "danger" : undefined,
            footnote: t.flagged > 0 ? "Open the flagged list" : "None flagged",
            href: guestsHref("flagged"),
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
        <CountDonut
          title="Nationalities (guests)"
          totalLabel="Guests"
          selected={nationality}
          onPick={(code) => go({ nationality: code, origin: null })}
          data={report.byNationality.map((n) => ({ key: n.code, label: n.name, count: n.count }))}
          empty={{ icon: "Globe", title: "No guests in this view", action: clearAction }}
        />
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <ChainCard report={report} className="lg:col-span-2" />
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="Who they are to their hosts">
            {report.byRelationship.length === 0 ? (
              <EmptyBlock size="sm" icon="Persons" title="No guests in this period" />
            ) : (
              <RankedBars
                what="relationship"
                total={totalRelationship}
                selected={relationship}
                onPick={(code) => go({ relationship: code })}
                rows={report.byRelationship.map((r) => ({ key: r.code, label: r.label, count: r.count }))}
              />
            )}
          </SectionCard>
          {report.byArea.length > 1 ? (
            <SectionCard title={`Guests by ${AREA_WORD[report.areaLevel].toLowerCase()}`}>
              <RankedBars
                what={AREA_WORD[report.areaLevel].toLowerCase()}
                total={report.byArea.reduce((n, a) => n + a.registered, 0)}
                rows={report.byArea.map((a) => ({ key: String(a.id), label: a.name, count: a.registered }))}
              />
            </SectionCard>
          ) : null}
        </div>
      </div>

      <SectionCard title="Homes with the most guests" contentClassName="gap-0">
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
