"use client";

import { Segment, Widget } from "@heroui-pro/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import { PieChart } from "@heroui-pro/react/pie-chart";
import { RadialChart } from "@heroui-pro/react/radial-chart";
import { type ReactNode, useId, useMemo, useState } from "react";
import { IconAction } from "./buttons.tsx";
import { formatNumber } from "./format.tsx";
import { useElementWidth, useNoFocusInside, useReducedMotion } from "./hooks.ts";
import type { IconKey } from "./icon.tsx";
import { formatMoney, formatMoneyAxis } from "./money.tsx";
import { EmptyBlock } from "./states.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Chart colours are theme tokens (`packages/ui/src/styles/injishi.css`), never hex:
 * - `--chart-cat-1..6`: categories, in this fixed order (slot 1 is the accent's teal). Checked for
 *   colour-blind separation on both themes' surfaces.
 * - `--chart-neutral`: a reference series (what was expected).
 * - `--chart-age-1..4`: how overdue, mild to severe (one hue, light to dark).
 */
export const CHART_COLOR = {
  cat: (n: number) => `var(--chart-cat-${((n - 1) % 6) + 1})`,
  neutral: "var(--chart-neutral)",
  age: (n: 1 | 2 | 3 | 4) => `var(--chart-age-${n})`,
  line: "var(--foreground)",
} as const;

export interface LegendEntry {
  label: string;
  color: string;
  /** Draw the key as a short line instead of a dot (a line series). */
  line?: boolean;
}

/** The chart's numbers as rows, for the table view: exact amounts, the first column names the row. */
export interface ChartTable {
  columns: string[];
  rows: string[][];
}

export interface ChartCardProps {
  title: ReactNode;
  /** One muted line: the period, the unit, a total. */
  description?: ReactNode;
  /** Identifies every series (always shown when there are two or more). */
  legend?: LegendEntry[];
  /** Small actions on the right of the title (a period switch, Export). */
  actions?: ReactNode;
  /** One or two sentences a screen reader hears instead of the picture: the headline and the trend. */
  summary: string;
  /** The same numbers as a table: adds a "Show the numbers" switch to the header. */
  table?: ChartTable;
  /** Nothing to plot yet: shows the empty state instead of an empty chart. */
  isEmpty?: boolean;
  empty?: { icon?: IconKey; title: string; description?: ReactNode; action?: ReactNode };
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * The frame of every chart: a title, a legend, the chart, and the same numbers in words. Screen readers
 * hear the summary; anyone can switch to the table view (exact amounts) with the button in the header.
 * With `isEmpty` it shows an empty state with the next step instead of an empty plot.
 */
export function ChartCard({
  title,
  description,
  legend,
  actions,
  summary,
  table,
  isEmpty,
  empty,
  footer,
  children,
  className,
  contentClassName,
}: ChartCardProps) {
  const titleId = useId();
  const summaryId = useId();
  const [asTable, setAsTable] = useState(false);
  const noFocus = useNoFocusInside();
  const canTable = Boolean(table) && !isEmpty;
  return (
    <Widget
      className={cx("h-full min-w-0", className)}
      render={(props) => <figure {...props} aria-labelledby={titleId} aria-describedby={summaryId} />}
    >
      <Widget.Header className="flex-wrap gap-y-1 pt-3 pb-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Widget.Title id={titleId} role="heading" aria-level={2}>
            {title}
          </Widget.Title>
          {description ? <Widget.Description>{description}</Widget.Description> : null}
        </div>
        {actions || canTable ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {canTable ? (
              <IconAction
                icon={asTable ? "ChartColumn" : "LayoutList"}
                label={asTable ? "Show the chart" : "Show the numbers"}
                aria-pressed={asTable}
                onPress={() => setAsTable((v) => !v)}
              />
            ) : null}
          </div>
        ) : null}
      </Widget.Header>
      <Widget.Content className={cx("flex min-w-0 flex-col gap-3", contentClassName)}>
        <p id={summaryId} className="sr-only">
          {isEmpty ? (empty?.title ?? "No data yet") : summary}
        </p>
        {isEmpty ? (
          <EmptyBlock
            size="sm"
            icon={empty?.icon ?? "ChartColumn"}
            title={empty?.title ?? "No data yet"}
            description={empty?.description}
            action={empty?.action}
          />
        ) : asTable && table ? (
          <NumbersTable title={typeof title === "string" ? title : "Chart"} table={table} />
        ) : (
          <>
            {legend && legend.length > 0 ? <ChartLegend entries={legend} /> : null}
            <div ref={noFocus} aria-hidden="true" className="ij-chart min-w-0">
              {children}
            </div>
          </>
        )}
      </Widget.Content>
      {footer ? <Widget.Footer className="flex-wrap text-xs text-muted">{footer}</Widget.Footer> : null}
    </Widget>
  );
}

function ChartLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul aria-hidden="true" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={cx("shrink-0", e.line ? "h-0.5 w-3 rounded-full" : "size-2 rounded-full")}
            style={{ background: e.color }}
          />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers as a compact table: the first column names the row, amounts right-aligned. */
function NumbersTable({ title, table }: { title: string; table: ChartTable }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">{title}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-separator text-muted">
            {table.columns.map((c, i) => (
              <th key={c} scope="col" className={cx("py-1.5 font-medium", i === 0 ? "text-left" : "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.join("|")} className="border-b border-separator last:border-b-0">
              {r.map((cell, i) =>
                i === 0 ? (
                  <th key={table.columns[i]} scope="row" className="py-1.5 pr-2 text-left font-medium">
                    {cell}
                  </th>
                ) : (
                  <td key={table.columns[i]} className="py-1.5 pl-2 text-right whitespace-nowrap tabular">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Shared pieces of the presets
// ---------------------------------------------------------------------------------------------------

/** "2026-10" as "Oct" (axis) or "October 2026" (tooltip). */
function monthLabel(month: string, long = false): string {
  const at = new Date(`${month.slice(0, 7)}-15T12:00:00Z`);
  return new Intl.DateTimeFormat("en-KE", {
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(at);
}

/** Below this width a chart shows fewer, wider bars instead of scrolling sideways. */
const NARROW = 480;

/** Keep the last `max` points on a narrow card (a phone); all of them otherwise. */
function useFitPoints<T>(data: readonly T[], narrowMax = 6) {
  const [ref, width] = useElementWidth();
  const narrow = width > 0 && width < NARROW;
  const points = narrow && data.length > narrowMax ? data.slice(-narrowMax) : [...data];
  return { ref, points, narrow, trimmed: points.length < data.length };
}

const axisProps = { tickLine: false, axisLine: false } as const;

/** "1,234,567": table cells under a header that says RWF. */
const bare = (v: number) => formatMoney(v, { bare: true });

function moneyTooltip(labelFormatter?: (label: string | number) => ReactNode) {
  return {
    valueFormatter: (v: number | string) => formatMoney(Number(v)),
    labelFormatter,
  };
}

const TOOLTIP_CURSOR = { fill: "var(--default)", opacity: 0.6 };

function TrimNote({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="text-xs text-muted">
      Showing the last {shown} of {total} months. The numbers view has all of them.
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------------

export interface MonthAmounts {
  /** `yyyy-mm`. */
  month: string;
  expected: number;
  collected: number;
}

/** Rent collected against rent expected, by month: grouped bars, expected in grey behind collected. */
export function CollectedVsExpectedBar({
  data,
  title = "Rent collected",
  description,
  actions,
  height = 240,
  emptyAction,
  className,
}: {
  data: MonthAmounts[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const { ref, points, trimmed } = useFitPoints(data);
  const expected = data.reduce((s, d) => s + d.expected, 0);
  const collected = data.reduce((s, d) => s + d.collected, 0);
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  const rows = points.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      legend={[
        { label: "Expected", color: CHART_COLOR.neutral },
        { label: "Collected", color: CHART_COLOR.cat(1) },
      ]}
      isEmpty={data.length === 0 || expected === 0}
      empty={{ icon: "Wallet", title: "No rent due in this period yet", action: emptyAction }}
      summary={`${formatMoney(collected)} collected of ${formatMoney(expected)} expected over ${data.length} months, ${rate}%.`}
      table={{
        columns: ["Month", "Expected (RWF)", "Collected (RWF)"],
        rows: data.map((d) => [monthLabel(d.month, true), bare(d.expected), bare(d.collected)]),
      }}
      footer={trimmed ? <TrimNote shown={points.length} total={data.length} /> : undefined}
    >
      <div ref={ref}>
        <BarChart data={rows} height={height} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <BarChart.Grid vertical={false} />
          <BarChart.XAxis dataKey="label" {...axisProps} interval={0} tickMargin={8} />
          <BarChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
          <BarChart.Tooltip
            cursor={TOOLTIP_CURSOR}
            content={
              <BarChart.TooltipContent
                {...moneyTooltip((l) => {
                  const hit = rows.find((r) => r.label === l);
                  return hit ? monthLabel(hit.month, true) : l;
                })}
              />
            }
          />
          <BarChart.Bar
            dataKey="expected"
            name="Expected"
            fill={CHART_COLOR.neutral}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={motion}
          />
          <BarChart.Bar
            dataKey="collected"
            name="Collected"
            fill={CHART_COLOR.cat(1)}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={motion}
          />
        </BarChart>
      </div>
    </ChartCard>
  );
}

export interface MonthFlow {
  /** `yyyy-mm`. */
  month: string;
  /** Money in: rent and deposits received. */
  moneyIn: number;
  /** Money out: expenses and refunds, as a positive amount. */
  moneyOut: number;
}

/** Money in above zero, money out below it, and the net as a line: one axis, in francs. */
export function CashFlowComposed({
  data,
  title = "Cash flow",
  description,
  actions,
  height = 260,
  emptyAction,
  className,
}: {
  data: MonthFlow[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const { ref, points, trimmed } = useFitPoints(data);
  const totalIn = data.reduce((s, d) => s + d.moneyIn, 0);
  const totalOut = data.reduce((s, d) => s + d.moneyOut, 0);
  const rows = points.map((d) => ({
    label: monthLabel(d.month),
    month: d.month,
    moneyIn: d.moneyIn,
    moneyOut: -Math.abs(d.moneyOut),
    net: d.moneyIn - Math.abs(d.moneyOut),
  }));
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      legend={[
        { label: "Money in", color: CHART_COLOR.cat(1) },
        { label: "Money out", color: CHART_COLOR.cat(3) },
        { label: "Net", color: CHART_COLOR.line, line: true },
      ]}
      isEmpty={data.length === 0 || (totalIn === 0 && totalOut === 0)}
      empty={{ icon: "ChartMixed", title: "No money in or out yet", action: emptyAction }}
      summary={`${formatMoney(totalIn)} in and ${formatMoney(totalOut)} out over ${data.length} months, net ${formatMoney(totalIn - totalOut, { signed: true })}.`}
      table={{
        columns: ["Month", "In (RWF)", "Out (RWF)", "Net (RWF)"],
        rows: data.map((d) => [
          monthLabel(d.month, true),
          bare(d.moneyIn),
          bare(d.moneyOut),
          formatMoney(d.moneyIn - d.moneyOut, { signed: true, bare: true }),
        ]),
      }}
      footer={trimmed ? <TrimNote shown={points.length} total={data.length} /> : undefined}
    >
      <div ref={ref}>
        <ComposedChart data={rows} height={height} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <ComposedChart.Grid vertical={false} />
          <ComposedChart.XAxis dataKey="label" {...axisProps} interval={0} tickMargin={8} />
          <ComposedChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
          <ComposedChart.Tooltip
            cursor={TOOLTIP_CURSOR}
            content={
              <ComposedChart.TooltipContent
                valueFormatter={(v) => formatMoney(Number(v), { signed: true })}
                labelFormatter={(l) => {
                  const hit = rows.find((r) => r.label === l);
                  return hit ? monthLabel(hit.month, true) : l;
                }}
              />
            }
          />
          <ComposedChart.Bar
            dataKey="moneyIn"
            name="Money in"
            fill={CHART_COLOR.cat(1)}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={motion}
          />
          <ComposedChart.Bar
            dataKey="moneyOut"
            name="Money out"
            fill={CHART_COLOR.cat(3)}
            radius={[0, 0, 4, 4]}
            maxBarSize={22}
            isAnimationActive={motion}
          />
          <ComposedChart.Line
            dataKey="net"
            name="Net"
            type="monotone"
            stroke={CHART_COLOR.line}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, fill: "var(--surface)" }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={motion}
          />
        </ComposedChart>
      </div>
    </ChartCard>
  );
}

/** How many months a money chart shows; the switch in its header offers these. */
export const CHART_PERIODS = [3, 6, 12] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

/** The period switch of a chart header: "3M 6M 12M", the months shown. */
export function ChartPeriodSwitch({
  value,
  onChange,
  periods = CHART_PERIODS,
  label = "Months shown",
}: {
  value: number;
  onChange: (months: number) => void;
  periods?: readonly number[];
  label?: string;
}) {
  return (
    <Segment aria-label={label} size="sm" selectedKey={String(value)} onSelectionChange={(k) => onChange(Number(k))}>
      {periods.map((p) => (
        <Segment.Item key={p} id={String(p)} aria-label={`Last ${p} months`}>
          {p}M
        </Segment.Item>
      ))}
    </Segment>
  );
}

/** The last `months` of a series, with the switch's state: what a money chart's period switch drives. */
function usePeriod<T>(data: readonly T[], initial: number) {
  const [months, setMonths] = useState(initial);
  const shown = useMemo(() => data.slice(-months), [data, months]);
  return { months, setMonths, shown };
}

function Gradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.26} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

/**
 * Rent collected against rent expected, month by month: collected as a filled area, expected as a dashed
 * line above it, so the gap between them is the rent still owed. Hover a month for both amounts and the
 * rate; the header switches between the last 3, 6 and 12 months.
 */
export function CollectedVsExpectedArea({
  data,
  title = "Rent collected",
  description,
  actions,
  height = 240,
  initialMonths = 6,
  emptyAction,
  className,
}: {
  data: MonthAmounts[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  /** The period shown first. @default 6 */
  initialMonths?: number;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const gradient = useId().replace(/:/g, "");
  const { months, setMonths, shown } = usePeriod(data, initialMonths);
  const expected = shown.reduce((s, d) => s + d.expected, 0);
  const collected = shown.reduce((s, d) => s + d.collected, 0);
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  const rows = shown.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ChartCard
      title={title}
      description={
        description ??
        (expected > 0 ? `${formatMoney(collected)} of ${formatMoney(expected)} over ${shown.length} months` : undefined)
      }
      actions={
        <>
          {actions}
          {data.length > 3 ? <ChartPeriodSwitch value={months} onChange={setMonths} /> : null}
        </>
      }
      className={className}
      legend={[
        { label: "Collected", color: CHART_COLOR.cat(1) },
        { label: "Expected", color: "var(--chart-other)", line: true },
      ]}
      isEmpty={data.length === 0 || data.every((d) => d.expected === 0 && d.collected === 0)}
      empty={{ icon: "Wallet", title: "No rent due yet", action: emptyAction }}
      summary={`${formatMoney(collected)} collected of ${formatMoney(expected)} expected over the last ${shown.length} months, ${rate}%.`}
      table={{
        columns: ["Month", "Expected (RWF)", "Collected (RWF)"],
        rows: shown.map((d) => [monthLabel(d.month, true), bare(d.expected), bare(d.collected)]),
      }}
    >
      <AreaChart data={rows} height={height} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <Gradient id={gradient} color={CHART_COLOR.cat(1)} />
        </defs>
        <AreaChart.Grid vertical={false} />
        <AreaChart.XAxis dataKey="label" {...axisProps} tickMargin={8} padding={{ left: 12, right: 12 }} />
        <AreaChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
        <AreaChart.Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <AreaChart.TooltipContent
              {...moneyTooltip((l) => {
                const hit = rows.find((r) => r.label === l);
                if (!hit) return l;
                const pct = hit.expected > 0 ? ` · ${Math.round((hit.collected / hit.expected) * 100)}%` : "";
                return `${monthLabel(hit.month, true)}${pct}`;
              })}
            />
          }
        />
        <AreaChart.Area
          dataKey="expected"
          name="Expected"
          type="monotone"
          stroke="var(--chart-other)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="transparent"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={motion}
        />
        <AreaChart.Area
          dataKey="collected"
          name="Collected"
          type="monotone"
          stroke={CHART_COLOR.cat(1)}
          strokeWidth={2}
          fill={`url(#${gradient})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={motion}
        />
      </AreaChart>
    </ChartCard>
  );
}

/**
 * Money in and money out, month by month, as two areas on one franc axis; hover a month for both and
 * the net. The header switches between the last 3, 6 and 12 months.
 */
export function CashFlowArea({
  data,
  title = "Cash flow",
  description,
  actions,
  height = 240,
  initialMonths = 6,
  emptyAction,
  className,
}: {
  data: MonthFlow[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  /** @default 6 */
  initialMonths?: number;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const inId = useId().replace(/:/g, "");
  const outId = `${inId}o`;
  const { months, setMonths, shown } = usePeriod(data, initialMonths);
  const totalIn = shown.reduce((s, d) => s + d.moneyIn, 0);
  const totalOut = shown.reduce((s, d) => s + Math.abs(d.moneyOut), 0);
  const net = totalIn - totalOut;
  const rows = shown.map((d) => ({
    label: monthLabel(d.month),
    month: d.month,
    moneyIn: d.moneyIn,
    moneyOut: Math.abs(d.moneyOut),
  }));
  return (
    <ChartCard
      title={title}
      description={description ?? `Net ${formatMoney(net, { signed: true })} over ${shown.length} months`}
      actions={
        <>
          {actions}
          {data.length > 3 ? <ChartPeriodSwitch value={months} onChange={setMonths} /> : null}
        </>
      }
      className={className}
      legend={[
        { label: "Money in", color: CHART_COLOR.cat(1) },
        { label: "Money out", color: CHART_COLOR.cat(3) },
      ]}
      isEmpty={data.length === 0 || data.every((d) => d.moneyIn === 0 && d.moneyOut === 0)}
      empty={{ icon: "ChartLine", title: "No money in or out yet", action: emptyAction }}
      summary={`${formatMoney(totalIn)} in and ${formatMoney(totalOut)} out over the last ${shown.length} months, net ${formatMoney(net, { signed: true })}.`}
      table={{
        columns: ["Month", "In (RWF)", "Out (RWF)", "Net (RWF)"],
        rows: rows.map((d) => [
          monthLabel(d.month, true),
          bare(d.moneyIn),
          bare(d.moneyOut),
          formatMoney(d.moneyIn - d.moneyOut, { signed: true, bare: true }),
        ]),
      }}
    >
      <AreaChart data={rows} height={height} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <Gradient id={inId} color={CHART_COLOR.cat(1)} />
          <Gradient id={outId} color={CHART_COLOR.cat(3)} />
        </defs>
        <AreaChart.Grid vertical={false} />
        <AreaChart.XAxis dataKey="label" {...axisProps} tickMargin={8} padding={{ left: 12, right: 12 }} />
        <AreaChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
        <AreaChart.Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <AreaChart.TooltipContent
              {...moneyTooltip((l) => {
                const hit = rows.find((r) => r.label === l);
                if (!hit) return l;
                return `${monthLabel(hit.month, true)} · net ${formatMoney(hit.moneyIn - hit.moneyOut, { signed: true })}`;
              })}
            />
          }
        />
        <AreaChart.Area
          dataKey="moneyIn"
          name="Money in"
          type="monotone"
          stroke={CHART_COLOR.cat(1)}
          strokeWidth={2}
          fill={`url(#${inId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={motion}
        />
        <AreaChart.Area
          dataKey="moneyOut"
          name="Money out"
          type="monotone"
          stroke={CHART_COLOR.cat(3)}
          strokeWidth={2}
          fill={`url(#${outId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          isAnimationActive={motion}
        />
      </AreaChart>
    </ChartCard>
  );
}

export interface MonthRate {
  /** `yyyy-mm`. */
  month: string;
  /** 0 to 100. */
  percent: number;
}

/** Occupancy at each month's end, as a percentage of the units that can be let. */
export function OccupancyArea({
  data,
  title = "Occupancy",
  description,
  actions,
  height = 220,
  emptyAction,
  className,
}: {
  data: MonthRate[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const gradient = useId().replace(/:/g, "");
  const { ref, points, trimmed } = useFitPoints(data, 6);
  const rows = points.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const last = data[data.length - 1];
  const first = data[0];
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      isEmpty={data.length === 0}
      empty={{ icon: "FolderHouse", title: "Add units to see occupancy", action: emptyAction }}
      summary={
        last && first
          ? `${formatNumber(last.percent, { maximumFractionDigits: 1 })}% occupied at the end of ${monthLabel(last.month, true)}, from ${formatNumber(first.percent, { maximumFractionDigits: 1 })}% in ${monthLabel(first.month, true)}.`
          : "No occupancy yet."
      }
      table={{
        columns: ["Month", "Occupied"],
        rows: data.map((d) => [monthLabel(d.month, true), `${formatNumber(d.percent, { maximumFractionDigits: 1 })}%`]),
      }}
      footer={trimmed ? <TrimNote shown={points.length} total={data.length} /> : undefined}
    >
      <div ref={ref}>
        <AreaChart data={rows} height={height} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <AreaChart.Grid vertical={false} />
          <AreaChart.XAxis
            dataKey="label"
            {...axisProps}
            interval={0}
            tickMargin={8}
            padding={{ left: 16, right: 16 }}
          />
          <AreaChart.YAxis
            {...axisProps}
            width={40}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <AreaChart.Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <AreaChart.TooltipContent
                valueFormatter={(v) => `${formatNumber(Number(v), { maximumFractionDigits: 1 })}%`}
                labelFormatter={(l) => {
                  const hit = rows.find((r) => r.label === l);
                  return hit ? monthLabel(hit.month, true) : l;
                }}
              />
            }
          />
          <AreaChart.Area
            dataKey="percent"
            name="Occupied"
            type="monotone"
            stroke={CHART_COLOR.cat(1)}
            strokeWidth={2}
            fill={`url(#${gradient})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={motion}
          />
        </AreaChart>
      </div>
    </ChartCard>
  );
}

export interface AgeingRow {
  /** What the bar is: a month (`yyyy-mm`) or any short label (a block). */
  label: string;
  /** Overdue amounts by how late they are. */
  d1to15: number;
  d16to30: number;
  d31to60: number;
  d61plus: number;
}

const AGE_BUCKETS = [
  { key: "d1to15", label: "1 to 15 days", short: "1-15 days", color: CHART_COLOR.age(1) },
  { key: "d16to30", label: "16 to 30 days", short: "16-30 days", color: CHART_COLOR.age(2) },
  { key: "d31to60", label: "31 to 60 days", short: "31-60 days", color: CHART_COLOR.age(3) },
  { key: "d61plus", label: "61 days or more", short: "61+ days", color: CHART_COLOR.age(4) },
] as const;

/** The index of the highest bucket with an amount in a row: the segment that gets the rounded top. */
function topBucket(row: Partial<AgeingRow> | undefined): number {
  if (!row) return -1;
  for (let i = AGE_BUCKETS.length - 1; i >= 0; i--) if ((row[AGE_BUCKETS[i].key] ?? 0) > 0) return i;
  return -1;
}

interface StackSegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  payload?: Partial<AgeingRow>;
}

/** One segment of a stacked bar; the top one of each bar gets 4px rounded corners. */
function StackSegment({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  stroke,
  strokeWidth,
  isTop,
}: StackSegmentProps & { isTop: boolean }) {
  if (width <= 0 || height <= 0) return <g />;
  const r = isTop ? Math.min(4, width / 2, height) : 0;
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

/** Overdue rent by how late it is, stacked from the mildest to the most overdue. */
export function AgeingStackedBar({
  data,
  title = "Overdue rent by age",
  description,
  actions,
  height = 240,
  className,
}: {
  data: AgeingRow[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  height?: number;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const { ref, points, trimmed } = useFitPoints(data);
  const isMonth = (l: string) => /^\d{4}-\d{2}/.test(l);
  const rows = points.map((d) => ({ ...d, name: isMonth(d.label) ? monthLabel(d.label) : d.label }));
  const totals = AGE_BUCKETS.map((b) => data.reduce((s, d) => s + d[b.key], 0));
  const total = totals.reduce((s, v) => s + v, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      legend={AGE_BUCKETS.map((b) => ({ label: b.label, color: b.color }))}
      isEmpty={data.length === 0 || total === 0}
      empty={{ icon: "CircleCheck", title: "Nothing overdue", description: "Every tenant is up to date." }}
      summary={`${formatMoney(total)} overdue: ${AGE_BUCKETS.map((b, i) => `${formatMoney(totals[i])} ${b.label} late`).join(", ")}.`}
      table={{
        columns: ["Period", ...AGE_BUCKETS.map((b) => b.short)],
        rows: data.map((d) => [
          isMonth(d.label) ? monthLabel(d.label, true) : d.label,
          ...AGE_BUCKETS.map((b) => bare(d[b.key])),
        ]),
      }}
      footer={trimmed ? <TrimNote shown={points.length} total={data.length} /> : undefined}
    >
      <div ref={ref}>
        <BarChart data={rows} height={height} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <BarChart.Grid vertical={false} />
          <BarChart.XAxis dataKey="name" {...axisProps} interval={0} tickMargin={8} />
          <BarChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
          <BarChart.Tooltip cursor={TOOLTIP_CURSOR} content={<BarChart.TooltipContent {...moneyTooltip()} />} />
          {AGE_BUCKETS.map((b, i) => (
            <BarChart.Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              stackId="age"
              fill={b.color}
              stroke="var(--surface)"
              strokeWidth={2}
              shape={(props: StackSegmentProps) => <StackSegment {...props} isTop={topBucket(props.payload) === i} />}
              maxBarSize={28}
              isAnimationActive={motion}
            />
          ))}
        </BarChart>
      </div>
    </ChartCard>
  );
}

export interface MonthAmount {
  /** `yyyy-mm`. */
  month: string;
  amount: number;
}

/** One amount a month as an area: what was spent, or what came in, month by month. */
export function MonthlyAmountArea({
  data,
  title,
  description,
  actions,
  seriesLabel = "Amount",
  height = 220,
  empty,
  narrowMonths = 6,
  className,
}: {
  data: MonthAmount[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The series' name in the tooltip and the numbers view ("Spent"). @default "Amount" */
  seriesLabel?: string;
  height?: number;
  /** The empty state's words and next step. */
  empty?: { icon?: IconKey; title: string; description?: ReactNode; action?: ReactNode };
  /** How many months a narrow card keeps. @default 6 */
  narrowMonths?: number;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const gradient = useId().replace(/:/g, "");
  const { ref, points, trimmed } = useFitPoints(data, narrowMonths);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const rows = points.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const top = data.reduce<MonthAmount | null>((best, d) => (!best || d.amount > best.amount ? d : best), null);
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      isEmpty={total === 0}
      empty={empty ?? { icon: "ChartLine", title: "Nothing in this period" }}
      summary={`${formatMoney(total)} over ${data.length} months.${top && top.amount > 0 ? ` Highest in ${monthLabel(top.month, true)}: ${formatMoney(top.amount)}.` : ""}`}
      table={{
        columns: ["Month", `${seriesLabel} (RWF)`],
        rows: data.map((d) => [monthLabel(d.month, true), bare(d.amount)]),
      }}
      footer={trimmed ? <TrimNote shown={points.length} total={data.length} /> : undefined}
    >
      <div ref={ref}>
        <AreaChart data={rows} height={height} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <AreaChart.Grid vertical={false} />
          <AreaChart.XAxis
            dataKey="label"
            {...axisProps}
            interval={0}
            tickMargin={8}
            padding={{ left: 16, right: 16 }}
          />
          <AreaChart.YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoneyAxis(v)} />
          <AreaChart.Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <AreaChart.TooltipContent
                {...moneyTooltip((l) => {
                  const hit = rows.find((r) => r.label === l);
                  return hit ? monthLabel(hit.month, true) : l;
                })}
              />
            }
          />
          <AreaChart.Area
            dataKey="amount"
            name={seriesLabel}
            type="monotone"
            stroke={CHART_COLOR.cat(1)}
            strokeWidth={2}
            fill={`url(#${gradient})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={motion}
          />
        </AreaChart>
      </div>
    </ChartCard>
  );
}

export interface CategoryAmount {
  category: string;
  amount: number;
}

/** The five largest categories and Other, as a ring with the total in the middle and a ranked list. */
export function CategoryDonut({
  data,
  title = "Expenses by category",
  description,
  actions,
  totalLabel = "Total",
  emptyAction,
  className,
}: {
  data: CategoryAmount[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  totalLabel?: string;
  emptyAction?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const positive = data.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  const top = positive.slice(0, 5);
  const rest = positive.slice(5).reduce((s, d) => s + d.amount, 0);
  const slices = [
    ...top.map((d, i) => ({ name: d.category, value: d.amount, color: CHART_COLOR.cat(i + 1) })),
    ...(rest > 0 ? [{ name: "Other", value: rest, color: "var(--chart-other)" }] : []),
  ];
  const total = slices.reduce((s, d) => s + d.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      isEmpty={total === 0}
      empty={{ icon: "Receipt", title: "No expenses in this period", action: emptyAction }}
      summary={`${formatMoney(total)} in total. ${slices.map((s) => `${s.name} ${formatMoney(s.value)} (${pct(s.value)}%)`).join(", ")}.`}
      table={{
        columns: ["Category", "Share", "Amount (RWF)"],
        rows: positive.map((d) => [d.category, `${pct(d.amount)}%`, bare(d.amount)]),
      }}
    >
      <div className="grid items-center gap-4 sm:grid-cols-2">
        <div className="relative mx-auto aspect-square w-full max-w-56">
          <PieChart height={224}>
            <PieChart.Tooltip
              content={<PieChart.TooltipContent hideHeader valueFormatter={(v) => formatMoney(Number(v))} />}
            />
            <PieChart.Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={motion}
            >
              {slices.map((s) => (
                <PieChart.Cell key={s.name} fill={s.color} />
              ))}
            </PieChart.Pie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-muted">{totalLabel}</span>
            <span className="text-lg font-semibold tabular">{formatMoney(total, { compact: total >= 1_000_000 })}</span>
          </div>
        </div>
        <ul className="flex min-w-0 flex-col gap-2">
          {slices.map((s) => (
            <li key={s.name} className="flex items-center gap-2 text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="text-xs text-muted tabular">{pct(s.value)}%</span>
              <span className="shrink-0 text-right font-medium tabular">{formatMoney(s.value, { bare: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/** One rate as a ring with the percentage in the middle: collection rate, occupancy, setup done. */
export function ProgressRadial({
  value,
  max = 100,
  title,
  description,
  caption,
  actions,
  className,
}: {
  value: number;
  /** @default 100 */
  max?: number;
  title: ReactNode;
  description?: ReactNode;
  /** One line under the figure in the ring ("collected"). */
  caption?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const motion = !useReducedMotion();
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const shown = formatNumber(percent, { maximumFractionDigits: 0 });
  return (
    <ChartCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      summary={`${shown}%${caption ? ` ${caption}` : ""}.`}
      contentClassName="justify-center"
    >
      <div className="relative mx-auto size-44">
        <RadialChart
          data={[{ name: "done", value: percent, fill: CHART_COLOR.cat(1) }]}
          height={165}
          innerRadius="78%"
          outerRadius="100%"
          barSize={12}
          startAngle={90}
          endAngle={-270}
        >
          <RadialChart.AngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialChart.Bar
            dataKey="value"
            background={{ fill: "var(--default)" }}
            cornerRadius={6}
            isAnimationActive={motion}
          />
        </RadialChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular">{shown}%</span>
          {caption ? <span className="text-xs text-muted">{caption}</span> : null}
        </div>
      </div>
    </ChartCard>
  );
}
