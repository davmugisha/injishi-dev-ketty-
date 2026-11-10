"use client";

import { Chip } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { LineChart } from "@heroui-pro/react/line-chart";
import { formatNumber } from "@injishi/ui";
import type { LeaveMonth } from "../../model/people.ts";
import { monthShort } from "./days";

/** The same colours as the calendar's legend under it. */
const SERIES = [
  { key: "annual", label: "Annual", color: "var(--accent)" },
  { key: "sick", label: "Sick", color: "var(--chart-4)" },
  { key: "other", label: "Other", color: "var(--chart-5)" },
] as const;

const daysWord = (n: number) => `${formatNumber(n)} ${n === 1 ? "day" : "days"}`;

/** Leave taken this year, month by month: when the team runs thin, so HR can plan cover. */
export function LeaveByMonth({ months }: { months: LeaveMonth[] }) {
  const inAll = (m: LeaveMonth) => m.annual + m.sick + m.other;
  const total = months.reduce((n, m) => n + inAll(m), 0);
  if (total === 0) return null;

  const series = SERIES.filter((s) => months.some((m) => m[s.key] > 0));
  const busiest = months.reduce((top, m) => (inAll(m) > inAll(top) ? m : top));
  const rows = months.map((m) => ({ ...m, label: monthShort(`${m.id}-01`) }));

  return (
    <Widget role="region" aria-labelledby="months-h" className="min-w-0">
      <Widget.Header className="flex-wrap gap-2">
        <Widget.Title id="months-h" role="heading" aria-level={2}>
          Leave by month
        </Widget.Title>
        <Widget.Legend className="flex-wrap">
          {series.map((s) => (
            <Widget.LegendItem key={s.key} color={s.color}>
              {s.label}
            </Widget.LegendItem>
          ))}
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-2xl font-bold tabular">{formatNumber(total)}</span>
            <span className="text-sm text-muted">Days taken this year</span>
          </div>
          <Chip size="sm" variant="soft">
            <Chip.Label className="tabular">
              Busiest · {monthShort(`${busiest.id}-01`)}, {daysWord(inAll(busiest))}
            </Chip.Label>
          </Chip>
        </div>
        <div
          role="img"
          aria-label={`${daysWord(total)} of leave taken this year. ${rows
            .map((r) => `${r.label} ${daysWord(inAll(r))}`)
            .join(", ")}`}
        >
          <LineChart data={rows} height={220} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <LineChart.Grid vertical={false} />
            <LineChart.XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
            <LineChart.YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <LineChart.Tooltip content={<LineChart.TooltipContent valueFormatter={(v) => daysWord(Number(v))} />} />
            {series.map((s) => (
              <LineChart.Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      </Widget.Content>
    </Widget>
  );
}
