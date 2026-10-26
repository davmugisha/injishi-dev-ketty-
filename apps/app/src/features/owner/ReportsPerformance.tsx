"use client";

import { CircleInfo, ShieldExclamation, Xmark } from "@gravity-ui/icons";
import { Button, Popover, ProgressBar, Table } from "@heroui/react";
import { KPIGroup, Segment, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { LineChart } from "@heroui-pro/react/line-chart";
import { screenHref } from "@injishi/data";
import type {
  ReportsChannel,
  ReportsKpi,
  ReportsMeasureDefinition,
  ReportsMeasureId,
  ReportsPickupWeek,
  ReportsProperty,
  ReportsRoomType,
  ReportsTrendDay,
} from "@injishi/data/fixtures/owner";
import { formatNumber, formatRwf, GateChip, KeyValueList, LinkButton, SectionHeader, TextLink } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useMemo, useRef } from "react";

/** Measures of the daily trend chart. */
export type ReportsTrendMetric = "occ" | "adr" | "revpar";

const METRICS: { id: ReportsTrendMetric; label: string }[] = [
  { id: "occ", label: "Occupancy" },
  { id: "adr", label: "ADR" },
  { id: "revpar", label: "RevPAR" },
];

/** Nights in the sample report window (the prototype's 1–12 Oct). */
const NIGHTS = 12;
/** Room nights sold by hotel and lodge in the window (channel share base). */
const CHANNEL_NIGHTS = 497;

/** The daily trend for one property and measure, as the artifact computes it from the group series. */
function trendSeries(days: ReportsTrendDay[], property: ReportsProperty, metric: ReportsTrendMetric) {
  const occ = (v: number) => Math.min(98, Math.round(v * property.occFactor));
  const adr = (v: number) => v * property.adrFactor;
  const round = (v: number) => Math.round(v * 10) / 10;
  if (metric === "occ") {
    return {
      points: days.map((d) => ({ label: d.label, ty: occ(d.occ), ly: occ(d.occLastYear) })),
      lo: 40,
      hi: 100,
      fmt: (v: number) => `${v}%`,
      label: "Occupancy",
    };
  }
  if (metric === "adr") {
    return {
      points: days.map((d) => ({ label: d.label, ty: round(adr(d.adr)), ly: round(adr(d.adrLastYear)) })),
      lo: 80,
      hi: 150,
      fmt: (v: number) => `${v}k`,
      label: "ADR in thousand RWF",
    };
  }
  return {
    points: days.map((d) => ({
      label: d.label,
      ty: round((occ(d.occ) * adr(d.adr)) / 100),
      ly: round((occ(d.occLastYear) * adr(d.adrLastYear)) / 100),
    })),
    lo: 30,
    hi: 130,
    fmt: (v: number) => `${v}k`,
    label: "RevPAR in thousand RWF",
  };
}

/** One performance measure with its "how is this defined" popover, anchored under the whole figure. */
function MeasureKpi({
  kpi,
  definition,
  isOpen,
  onOpenChange,
}: {
  kpi: ReportsKpi;
  definition: ReportsMeasureDefinition | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <KPI ref={anchor} className="min-w-[180px] flex-[1_1_180px]">
      <KPI.Header className="flex items-center gap-1">
        <KPI.Title>{kpi.label}</KPI.Title>
        <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`How ${kpi.label} is defined`}
            className="size-6 min-w-6"
          >
            <CircleInfo className="size-4" />
          </Button>
          {definition ? (
            <Popover.Content
              triggerRef={anchor}
              placement="bottom start"
              offset={-6}
              isNonModal
              className="w-[360px] max-w-[calc(100vw-32px)]"
            >
              <Popover.Dialog className="flex flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">Measure definition · {definition.version}</span>
                    <Popover.Heading level={2} className="text-[15px] leading-[22px] font-semibold">
                      {definition.name}
                    </Popover.Heading>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="Close definition"
                    onPress={() => onOpenChange(false)}
                  >
                    <Xmark className="size-4" />
                  </Button>
                </div>
                <KeyValueList
                  className="grid-cols-[76px_minmax(0,1fr)]! gap-x-3! gap-y-1.5! text-xs! leading-[18px]!"
                  items={[
                    { label: "Formula", value: definition.formula },
                    { label: "Rules", value: definition.rules },
                    { label: "Window", value: definition.window },
                    { label: "Source", value: definition.source },
                    { label: "Owner", value: definition.owner },
                  ]}
                />
                <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                  Definition awaiting Finance approval
                </GateChip>
              </Popover.Dialog>
            </Popover.Content>
          ) : null}
        </Popover>
      </KPI.Header>
      <KPI.Content>
        <KPI.Value value={kpi.value} formatOptions={kpi.format} className="tabular" />
        <KPI.Trend trend={kpi.trendDirection}>{kpi.trend}</KPI.Trend>
      </KPI.Content>
      <KPI.Footer>
        <NextLink
          href={screenHref(kpi.board)}
          className="mt-1.5 inline-block text-xs leading-4 text-muted no-underline hover:text-foreground"
        >
          {kpi.foot} ›
        </NextLink>
      </KPI.Footer>
    </KPI>
  );
}

export function ReportsPerformancePanel({
  property,
  kpis,
  definitions,
  openDefinition,
  onDefinitionChange,
  metric,
  onMetricChange,
  trendDays,
  pickup,
  roomTypes,
  channels,
}: {
  property: ReportsProperty;
  kpis: ReportsKpi[];
  definitions: ReportsMeasureDefinition[];
  openDefinition: ReportsMeasureId | null;
  onDefinitionChange: (measure: ReportsMeasureId | null) => void;
  metric: ReportsTrendMetric;
  onMetricChange: (metric: ReportsTrendMetric) => void;
  trendDays: ReportsTrendDay[];
  pickup: ReportsPickupWeek[];
  roomTypes: ReportsRoomType[];
  channels: ReportsChannel[];
}) {
  const trend = useMemo(() => trendSeries(trendDays, property, metric), [trendDays, property, metric]);
  const mid = (trend.hi + trend.lo) / 2;
  const axisLabel = (i: number) => (i === 0 || i === 5 || i === trend.points.length - 1 ? trend.points[i]?.label : "");
  const topChannel = Math.max(...channels.map((c) => c.nights));

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Performance measures">
        <KPIGroup className="flex-wrap">
          {kpis.map((kpi, i) => (
            <Fragment key={kpi.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <MeasureKpi
                kpi={kpi}
                definition={definitions.find((d) => d.id === kpi.measure)}
                isOpen={openDefinition === kpi.measure}
                onOpenChange={(open) => onDefinitionChange(open ? kpi.measure : null)}
              />
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <Widget render={(props) => <section {...props} />} aria-labelledby="trend-h">
          <Widget.Header className="flex-wrap gap-2 pt-1">
            <Widget.Title id="trend-h" role="heading" aria-level={2}>
              Daily Trend · {property.title} · Sample
            </Widget.Title>
            <Segment
              size="sm"
              aria-label="Measure"
              selectedKey={metric}
              onSelectionChange={(k) => onMetricChange(String(k) as ReportsTrendMetric)}
            >
              {METRICS.map((m) => (
                <Segment.Item key={m.id} id={m.id}>
                  <Segment.Separator />
                  {m.label}
                </Segment.Item>
              ))}
            </Segment>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-2">
            <Widget.Legend>
              <Widget.LegendItem color="var(--chart-3)">This year</Widget.LegendItem>
              <Widget.LegendItem color="var(--chart-5)">Same dates last year</Widget.LegendItem>
            </Widget.Legend>
            <div className="flex items-stretch gap-2">
              <div className="flex w-11 shrink-0 flex-col justify-between py-0.5 text-right text-[11px] text-muted tabular">
                <span>{trend.fmt(trend.hi)}</span>
                <span>{trend.fmt(mid)}</span>
                <span>{trend.fmt(trend.lo)}</span>
              </div>
              <div
                role="img"
                aria-label={`Sample series: ${trend.label} per night against the same dates a year earlier, not this business's nights`}
                className="min-w-0 flex-1"
              >
                <LineChart data={trend.points} height={180} margin={{ top: 10, right: 2, bottom: 10, left: 2 }}>
                  <LineChart.Grid vertical={false} />
                  <LineChart.XAxis dataKey="label" hide />
                  <LineChart.YAxis hide domain={[trend.lo, trend.hi]} ticks={[trend.lo, mid, trend.hi]} />
                  <LineChart.Tooltip
                    content={<LineChart.TooltipContent valueFormatter={(v) => trend.fmt(Number(v))} />}
                  />
                  <LineChart.Line
                    type="linear"
                    dataKey="ly"
                    name="Same dates last year"
                    stroke="var(--chart-5)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <LineChart.Line
                    type="linear"
                    dataKey="ty"
                    name="This year"
                    stroke="var(--chart-3)"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </div>
            </div>
            <div className="flex gap-1.5 pl-[52px] text-[11px] text-muted">
              {trend.points.map((p, i) => (
                <span key={p.label} className="flex-1 basis-0 text-center whitespace-nowrap">
                  {axisLabel(i)}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted">
              {trend.label} per night. Source: stays, room status and posted room charges. Tonight is on the books, not
              final.
            </p>
          </Widget.Content>
        </Widget>

        <Widget render={(props) => <section {...props} />} aria-labelledby="pick-h">
          <Widget.Header className="pt-1">
            <Widget.Title id="pick-h" role="heading" aria-level={2}>
              Pickup · Next Four Weeks · Sample
            </Widget.Title>
            <Widget.Legend>
              <Widget.LegendItem color="var(--chart-5)">7 days ago</Widget.LegendItem>
              <Widget.LegendItem color="var(--chart-3)">Today</Widget.LegendItem>
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-2.5">
            <div
              role="img"
              aria-label="Occupancy on the books by week, today against seven days ago"
              className="flex flex-col gap-1"
            >
              <div className="grid grid-cols-4 gap-[18px]">
                {pickup.map((p) => (
                  <span key={p.id} className="text-center text-xs font-semibold tabular">
                    {p.now}% <span className="text-success">+{p.now - p.was}</span>
                  </span>
                ))}
              </div>
              <BarChart
                data={pickup.map((p) => ({ week: p.week, was: p.was, now: p.now }))}
                height={110}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <BarChart.XAxis dataKey="week" hide />
                <BarChart.YAxis hide domain={[0, 100]} />
                <BarChart.Tooltip
                  cursor={false}
                  content={<BarChart.TooltipContent valueFormatter={(v) => `${v}%`} />}
                />
                <BarChart.Bar
                  dataKey="was"
                  name="7 days ago"
                  fill="var(--chart-5)"
                  radius={[5, 5, 2, 2]}
                  isAnimationActive={false}
                />
                <BarChart.Bar
                  dataKey="now"
                  name="Today"
                  fill="var(--chart-3)"
                  radius={[5, 5, 2, 2]}
                  isAnimationActive={false}
                />
              </BarChart>
            </div>
            <div className="grid grid-cols-4 gap-[18px] text-center text-[11px] text-muted">
              {pickup.map((p) => (
                <span key={p.id}>{p.week}</span>
              ))}
            </div>
            <p className="text-xs text-muted">
              Sample weeks, not this business's bookings: pickup is not worked out from reservations yet.{" "}
              <TextLink href={screenHref("Groups")}>Group blocks</TextLink>
            </p>
          </Widget.Content>
        </Widget>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="rt-h">
          <SectionHeader
            id="rt-h"
            title="By Room Type · Sample"
            className="items-center"
            action={
              <LinkButton href={screenHref("RatesInventory")} size="sm" variant="ghost">
                Rates &amp; inventory
              </LinkButton>
            }
          />
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="By room type">
                <Table.Header>
                  <Table.Column isRowHeader>Room type</Table.Column>
                  <Table.Column>Occupancy</Table.Column>
                  <Table.Column className="text-right">ADR</Table.Column>
                  <Table.Column className="text-right">RevPAR</Table.Column>
                  <Table.Column className="text-right">Nights</Table.Column>
                </Table.Header>
                <Table.Body>
                  {roomTypes.map((r) => {
                    const available = r.rooms * NIGHTS;
                    const occ = Math.round((r.sold / available) * 100);
                    return (
                      <Table.Row key={r.id} id={r.id}>
                        <Table.Cell>
                          <NextLink href={screenHref("RoomRack")} className="flex flex-col text-inherit no-underline">
                            <span className="font-medium">{r.name}</span>
                            <span className="text-xs text-muted">
                              {r.propertyName} · {r.rooms} rooms
                            </span>
                          </NextLink>
                        </Table.Cell>
                        <Table.Cell className="min-w-[120px]">
                          <ProgressBar
                            value={occ}
                            aria-label={`${r.name} occupancy`}
                            className="gap-1 [--progress-bar-fill:var(--chart-3)]"
                          >
                            <span className="tabular">{occ}%</span>
                            <ProgressBar.Track>
                              <ProgressBar.Fill />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{formatRwf(r.adr)}</Table.Cell>
                        <Table.Cell className="text-right tabular">
                          {formatRwf(Math.round((r.sold * r.adr) / available))}
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{r.sold}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <p className="text-xs text-muted">
            ADR includes breakfast packages, split by component. Residence units are never counted here.
          </p>
        </section>

        <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="ch-h">
          <SectionHeader
            id="ch-h"
            title="By Channel · Sample"
            className="items-center"
            action={
              <LinkButton href={screenHref("Channels")} size="sm" variant="ghost">
                Distribution
              </LinkButton>
            }
          />
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="By channel, hotel and lodge">
                <Table.Header>
                  <Table.Column isRowHeader>Channel</Table.Column>
                  <Table.Column>Share of nights</Table.Column>
                  <Table.Column className="text-right">ADR</Table.Column>
                  <Table.Column className="text-right">Commission</Table.Column>
                </Table.Header>
                <Table.Body>
                  {channels.map((c) => {
                    const share = formatNumber((c.nights / CHANNEL_NIGHTS) * 100, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    });
                    return (
                      <Table.Row key={c.id} id={c.id}>
                        <Table.Cell>
                          <NextLink
                            href={screenHref("Reservations")}
                            className="flex flex-col text-inherit no-underline"
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted tabular">{c.nights} nights</span>
                          </NextLink>
                        </Table.Cell>
                        <Table.Cell className="min-w-[130px]">
                          <ProgressBar
                            value={Math.round((c.nights / topChannel) * 100)}
                            aria-label={`${c.name} share of nights`}
                            className="gap-1 [--progress-bar-fill:var(--chart-2)]"
                          >
                            <span className="tabular">{share}%</span>
                            <ProgressBar.Track>
                              <ProgressBar.Fill />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{formatRwf(c.adr)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{c.commission}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>
      </div>
    </div>
  );
}
