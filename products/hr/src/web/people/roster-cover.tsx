"use client";

import { Chip } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import { LabelList } from "recharts";

/** One day of the week on the chart: how many are on shift and how many the cover rule asks for. */
export interface CoverDay {
  label: string;
  onShift: number;
  needed: number;
}

const ON_SHIFT = "var(--chart-4)";
const NEEDED = "var(--foreground)";

/** The week's cover at a glance: a bar for who is on shift, a line for who is needed. A bar under the line is a short day. */
export function RosterCover({ days }: { days: CoverDay[] }) {
  const short = days.filter((d) => d.onShift < d.needed).length;
  const rows = days.map((d) => ({ ...d }));

  return (
    <Widget role="region" aria-labelledby="cover-h" className="min-w-0">
      <Widget.Header className="flex-wrap gap-2">
        <Widget.Title id="cover-h" role="heading" aria-level={2}>
          Cover this week
        </Widget.Title>
        <Chip size="sm" variant="soft" color={short ? "warning" : "accent"}>
          {short ? `${short} ${short === 1 ? "day needs" : "days need"} more staff` : "Every day covered"}
        </Chip>
      </Widget.Header>
      <Widget.Content>
        <div
          role="img"
          aria-label={`Cover this week. ${days
            .map((d) => `${d.label}: ${d.onShift} on shift, ${d.needed} needed`)
            .join("; ")}`}
        >
          <ComposedChart data={rows} height={240} margin={{ top: 20, right: 8, bottom: 0, left: -20 }}>
            <ComposedChart.Grid vertical={false} />
            <ComposedChart.XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <ComposedChart.YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <ComposedChart.Tooltip
              content={
                <ComposedChart.TooltipContent valueFormatter={(v) => `${v} ${Number(v) === 1 ? "person" : "people"}`} />
              }
            />
            <ComposedChart.Bar
              dataKey="onShift"
              name="On shift"
              fill={ON_SHIFT}
              radius={[6, 6, 0, 0]}
              maxBarSize={52}
              isAnimationActive={false}
            >
              <LabelList dataKey="onShift" position="top" fill="var(--foreground)" fontSize={11} fontWeight={600} />
            </ComposedChart.Bar>
            <ComposedChart.Line
              type="monotone"
              dataKey="needed"
              name="Needed"
              stroke={NEEDED}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </div>
      </Widget.Content>
      <Widget.Footer>
        <Widget.Legend className="flex-wrap">
          <Widget.LegendItem color={ON_SHIFT}>On shift</Widget.LegendItem>
          <Widget.LegendItem color={NEEDED}>Needed</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Footer>
    </Widget>
  );
}
