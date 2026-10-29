"use client";

import { Card, Chip, ToggleButton } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import type { RevenueEvent, RevenueScenario } from "@injishi/product-pms";
import { useBoardHref } from "@injishi/product-pms/web";
import { TextLink } from "@injishi/ui";
import { type RevenueNightRow, revenueNightEvent } from "./RevenueModel";

const REVENUE_Y_LABELS = ["100%", "75%", "50%", "25%", "0%"];
/** An x-axis date label every week, starting with the first night. */
const REVENUE_X_EVERY = 7;
const REVENUE_CHART_HEIGHT = 220;

const revenueShade: Record<string, string> = {
  info: "bg-accent-soft",
  accent: "bg-accent-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  success: "bg-success-soft",
  default: "bg-default",
};

function RevenueStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-semibold tabular">{value}</span>
      <span className="text-xs text-muted tabular">{note}</span>
    </div>
  );
}

/** Demand forecast: 30 nights of forecast (80% range), rooms on the books and last year, with a night picker. */
export function RevenueForecast({
  rows,
  events,
  scenario,
  selected,
  onSelect,
}: {
  rows: RevenueNightRow[];
  events: RevenueEvent[];
  scenario: RevenueScenario | undefined;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const screenHref = useBoardHref();
  const count = Math.max(rows.length, 1);
  const indexOf = new Map(rows.map((r, i) => [r.night.id, i]));
  const chartData = rows.map(({ night, forecast }) => ({
    night: night.id,
    onTheBooks: night.onTheBooks,
    lastYear: night.lastYear,
    forecast: forecast.value,
    low: forecast.low,
    high: forecast.high,
  }));
  const shades = events.flatMap((e) => {
    const first = indexOf.get(e.firstNight);
    const last = indexOf.get(e.lastNight);
    if (!e.tone || first === undefined || last === undefined) return [];
    return [{ id: e.id, tone: e.tone, left: (first / count) * 100, width: ((last - first + 1) / count) * 100 }];
  });
  const lowest = rows.length ? Math.min(...rows.map((r) => r.forecast.value)) : 0;
  const chartAria = `Forecast occupancy for the next 30 nights, 13 October to 11 November, scenario ${scenario?.name ?? ""}, with an 80% range. Bars show rooms on the books; a thin line shows last year. Highest forecast 100% on 24 and 25 October; lowest ${lowest}%.`;

  const current = rows[selected] ?? rows[0];
  const booked = current ? Math.round((current.night.onTheBooks * current.night.rooms) / 100) : 0;

  return (
    <section aria-labelledby="fc-h" className="min-w-0">
      <Widget>
        <Widget.Header className="flex-wrap gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="fc-h" className="flex flex-wrap items-center gap-2">
              <Widget.Title>Demand Forecast</Widget.Title>
              <Chip size="sm" variant="soft" color="warning">
                Forecast
              </Chip>
            </h2>
            <Widget.Description className="text-xs">
              Model DF-2.3 · data as of Mon 12 Oct, 06:00 CAT · scenario: {scenario?.name}
            </Widget.Description>
          </div>
          <Widget.Legend className="flex-wrap">
            <Widget.LegendItem color="var(--chart-3)">Forecast, 80% range shaded</Widget.LegendItem>
            <Widget.LegendItem color="var(--chart-5)">On the books</Widget.LegendItem>
            <Widget.LegendItem color="var(--muted)">Last year actual</Widget.LegendItem>
          </Widget.Legend>
        </Widget.Header>
        <Widget.Content className="flex flex-col gap-2">
          <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2">
            <div className="flex h-[220px] flex-col justify-between pt-1 text-right text-[11px] text-muted tabular">
              {REVENUE_Y_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="relative h-[220px]">
              {shades.map((s) => (
                <span
                  key={s.id}
                  aria-hidden="true"
                  className={`absolute inset-y-0 ${revenueShade[s.tone] ?? "bg-default"}`}
                  style={{ left: `${s.left}%`, width: `${s.width}%` }}
                />
              ))}
              <div role="img" aria-label={chartAria} className="relative">
                <ComposedChart
                  data={chartData}
                  height={REVENUE_CHART_HEIGHT}
                  margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                >
                  <ComposedChart.Grid vertical={false} />
                  <ComposedChart.XAxis dataKey="night" hide />
                  <ComposedChart.YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} hide />
                  <ComposedChart.Bar
                    dataKey="onTheBooks"
                    name="On the books"
                    fill="var(--chart-5)"
                    barSize="53%"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <ComposedChart.Area
                    dataKey={(d: { low: number; high: number }) => [d.low, d.high]}
                    name="80% range"
                    type="linear"
                    stroke="none"
                    fill="var(--chart-3)"
                    fillOpacity={0.2}
                    isAnimationActive={false}
                  />
                  <ComposedChart.Line
                    dataKey="lastYear"
                    name="Last year actual"
                    type="linear"
                    stroke="var(--muted)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <ComposedChart.Line
                    dataKey="forecast"
                    name="Forecast"
                    type="linear"
                    stroke="var(--chart-3)"
                    strokeWidth={2.5}
                    strokeDasharray="7 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </div>
              <div className="absolute inset-0 flex">
                {rows.map(({ night, forecast }, i) => (
                  <ToggleButton
                    key={night.id}
                    variant="ghost"
                    isSelected={selected === i}
                    onChange={() => onSelect(i)}
                    aria-label={`${night.weekday} ${night.day} ${night.month}: forecast ${forecast.value}%, on the books ${night.onTheBooks}%`}
                    className="h-full w-auto min-w-0 flex-1 basis-0 rounded-[4px] px-0 [--toggle-button-bg-hover:color-mix(in_oklab,var(--accent)_7%,transparent)] [--toggle-button-bg-pressed:color-mix(in_oklab,var(--accent)_10%,transparent)] [--toggle-button-bg-selected-hover:color-mix(in_oklab,var(--accent)_14%,transparent)] [--toggle-button-bg-selected-pressed:color-mix(in_oklab,var(--accent)_14%,transparent)] [--toggle-button-bg-selected:color-mix(in_oklab,var(--accent)_14%,transparent)] [--toggle-button-bg:transparent] md:h-full"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2">
            <span />
            <div className="relative h-4 text-[11px] text-muted tabular">
              {rows.map(({ night }, i) =>
                i % REVENUE_X_EVERY === 0 ? (
                  <span
                    key={night.id}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${((i + 0.5) / count) * 100}%` }}
                  >
                    {night.day} {night.month}
                  </span>
                ) : null,
              )}
            </div>
          </div>

          {current ? (
            <Card variant="secondary" className="mt-1 gap-2 px-[14px] py-3" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {current.night.weekday} {current.night.day} {current.night.month} {current.night.id.slice(0, 4)}
                </span>
                <span className="text-xs text-muted">{revenueNightEvent(events, current.night.id)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <RevenueStat
                  label="Forecast"
                  value={`${current.forecast.value}%`}
                  note={`range ${current.forecast.low}–${current.forecast.high}%`}
                />
                <RevenueStat
                  label="On the books"
                  value={`${current.night.onTheBooks}%`}
                  note={`${booked} of ${current.night.rooms} rooms`}
                />
                <RevenueStat label="Last year" value={`${current.night.lastYear}%`} note="actual, same weekday" />
                <RevenueStat label="Left to sell" value={String(current.night.rooms - booked)} note="rooms" />
              </div>
            </Card>
          ) : null}

          <p className="text-xs leading-4 text-muted">
            Inputs: 2,184 bookings since Jan 2024, on-the-books reservations, the EAC Health Forum block (contracted)
            and manually entered Rubavu events. Backtest error over the last 90 days: ±6.2 points. Booking.com
            reservations after 05:12 are missing because of a sync error ·{" "}
            <TextLink href={screenHref("Channels")} className="text-xs">
              Distribution
            </TextLink>
          </p>
        </Widget.Content>
      </Widget>
    </section>
  );
}
