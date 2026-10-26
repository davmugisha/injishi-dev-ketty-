"use client";

import { AreaChart } from "@heroui-pro/react/area-chart";
import type { BrokerFeeLine } from "@injishi/contracts";
import { CHART_COLOR, ChartCard, formatMoney, formatMoneyAxis } from "@injishi/ui";
import { useId } from "react";

/** "2026-10" as "Oct", or "October 2026" for the tooltip. */
function monthLabel(month: string, long = false): string {
  const at = new Date(`${month.slice(0, 7)}-15T12:00:00Z`);
  return new Intl.DateTimeFormat("en-KE", {
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(at);
}

/** `yyyy-mm` plus `n` months. */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fees as running totals over twelve months: what landlords recorded as earned (by the month the lease
 * starts) and what they marked paid (by the month they paid). The gap between the two is still owed.
 * The months end at this month, or at the latest lease start when a lease starts later.
 */
export function FeesChart({
  fees,
  today,
  className,
}: {
  fees: readonly BrokerFeeLine[];
  today: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const live = fees.filter((f) => f.fee.status !== "void");
  const lastMonth = live.reduce(
    (max, f) => (f.startDate.slice(0, 7) > max ? f.startDate.slice(0, 7) : max),
    today.slice(0, 7),
  );
  const first = shiftMonth(lastMonth, -11);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(first, i));
  const rows = months.map((month) => {
    const earned = live.filter((f) => f.startDate.slice(0, 7) <= month).reduce((sum, f) => sum + f.fee.amountRwf, 0);
    const paid = live
      .filter((f) => f.fee.status === "paid" && f.fee.paidAt && f.fee.paidAt.slice(0, 7) <= month)
      .reduce((sum, f) => sum + f.fee.amountRwf, 0);
    return { month, label: monthLabel(month), earned, paid };
  });
  const last = rows.at(-1);
  return (
    <ChartCard
      title="Fees over the year"
      description={
        last && last.earned > 0 ? `${formatMoney(last.earned)} earned, ${formatMoney(last.paid)} paid` : undefined
      }
      className={className}
      legend={[
        { label: "Earned", color: CHART_COLOR.cat(2) },
        { label: "Paid", color: CHART_COLOR.cat(1) },
      ]}
      isEmpty={!last || last.earned === 0}
      empty={{ icon: "Wallet", title: "No fees yet", description: "A fee shows once a landlord names you on a lease." }}
      summary={
        last
          ? `${formatMoney(last.earned)} earned and ${formatMoney(last.paid)} paid by ${monthLabel(last.month, true)}.`
          : "No fees yet."
      }
      table={{
        columns: ["Month", "Earned to date (RWF)", "Paid to date (RWF)"],
        rows: rows.map((r) => [
          monthLabel(r.month, true),
          formatMoney(r.earned, { bare: true }),
          formatMoney(r.paid, { bare: true }),
        ]),
      }}
    >
      <AreaChart data={rows} height={220} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`${id}-paid`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART_COLOR.cat(1)} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`${id}-earned`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR.cat(2)} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLOR.cat(2)} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <AreaChart.Grid vertical={false} />
        <AreaChart.XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          padding={{ left: 12, right: 12 }}
        />
        <AreaChart.YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatMoneyAxis(v)}
        />
        <AreaChart.Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <AreaChart.TooltipContent
              valueFormatter={(v: number | string) => formatMoney(Number(v))}
              labelFormatter={(l: string | number) => {
                const hit = rows.find((r) => r.label === l);
                return hit ? monthLabel(hit.month, true) : l;
              }}
            />
          }
        />
        <AreaChart.Area
          dataKey="earned"
          name="Earned"
          type="monotone"
          stroke={CHART_COLOR.cat(2)}
          strokeWidth={2}
          fill={`url(#${id}-earned)`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
        />
        <AreaChart.Area
          dataKey="paid"
          name="Paid"
          type="monotone"
          stroke={CHART_COLOR.cat(1)}
          strokeWidth={2}
          fill={`url(#${id}-paid)`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
        />
      </AreaChart>
    </ChartCard>
  );
}
