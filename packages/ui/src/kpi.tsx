"use client";

import { KPIGroup, TrendChip } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Fragment, type ReactNode } from "react";
import { formatNumber } from "./format.tsx";
import { Icon, type IconKey } from "./icon.tsx";
import { formatMoney } from "./money.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface KpiTrend {
  /** The change in percent: 12 for +12%, -4 for -4%. */
  percent: number;
  /** Which way is good for this figure. Overdue rent going up is bad. @default "up" */
  goodWhen?: "up" | "down";
  /** What it compares with, for the muted text beside it ("vs September"). */
  versus?: string;
}

export interface KpiItem {
  id: string;
  /** Short: "Collected", "Occupancy", "Overdue". */
  label: string;
  value: number;
  /** "money" (whole francs), "count" or "percent" (0 to 100). @default "money" */
  format?: "money" | "count" | "percent";
  /**
   * Money from one million up reads compact ("RWF 12.5M"), with the exact amount on hover and for screen
   * readers, so the strip fits on a phone. Set false to always show the exact amount.
   */
  compact?: boolean;
  icon?: IconKey;
  /** Tints the icon when the figure needs attention. Leave it out when all is well. */
  status?: "success" | "warning" | "danger";
  trend?: KpiTrend;
  /** One muted line: "4 of 12 tenants", "Due by 5 Nov". */
  footnote?: ReactNode;
  /** A small trend line under the value, oldest first (the last 6 to 12 months). */
  spark?: number[];
  /** A progress bar from 0 to 100 under the value (collection rate, occupancy). */
  progress?: number;
}

function valueText(k: KpiItem, exact: boolean): string {
  const format = k.format ?? "money";
  if (format === "percent") return `${formatNumber(k.value, { maximumFractionDigits: 1 })}%`;
  if (format === "count") return formatNumber(k.value);
  const compact = !exact && k.compact !== false && Math.abs(k.value) >= 1_000_000;
  return formatMoney(k.value, { compact });
}

function trendTone(t: KpiTrend): "up" | "down" | "neutral" {
  if (t.percent === 0) return "neutral";
  return t.percent > 0 ? "up" : "down";
}

function Trend({ trend }: { trend: KpiTrend }) {
  const direction = trendTone(trend);
  const good = direction === "neutral" ? null : (trend.goodWhen ?? "up") === direction;
  const words = `${trend.percent > 0 ? "up" : trend.percent < 0 ? "down" : "no change"}${
    trend.percent !== 0 ? ` ${formatNumber(Math.abs(trend.percent), { maximumFractionDigits: 1 })}%` : ""
  }${trend.versus ? ` ${trend.versus}` : ""}`;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <TrendChip
        trend={direction}
        size="sm"
        aria-hidden="true"
        // TrendChip colours "up" green and "down" red; the tone says whether this change is good instead.
        data-tone={good === null ? undefined : good ? "success" : "danger"}
      >
        {formatNumber(Math.abs(trend.percent), { maximumFractionDigits: 1 })}%
      </TrendChip>
      {trend.versus ? (
        <span aria-hidden="true" className="text-xs text-muted">
          {trend.versus}
        </span>
      ) : null}
      <span className="sr-only">{words}</span>
    </span>
  );
}

/**
 * The figure strip at the top of a page: three to seven headline numbers. Two to a row on a phone, one
 * row from lg up. Every figure carries its exact value for screen readers; trends say which way is good.
 */
export function KpiStrip({ label, items, className }: { label: string; items: KpiItem[]; className?: string }) {
  const odd = items.length % 2 === 1;
  return (
    <section aria-label={label} className={cx("min-w-0", className)}>
      <KPIGroup className="grid grid-cols-2 gap-px bg-separator lg:flex lg:gap-0 lg:bg-surface">
        {items.map((k, i) => {
          const shown = valueText(k, false);
          const exact = valueText(k, true);
          return (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator className="hidden lg:block" /> : null}
              <KPI
                className={cx(
                  "min-w-0 rounded-none bg-surface lg:flex-1",
                  odd && i === items.length - 1 && "col-span-2 lg:col-span-1",
                )}
              >
                <KPI.Header>
                  {k.icon ? (
                    <KPI.Icon status={k.status} className={cx(!k.status && "bg-default text-muted")}>
                      <Icon name={k.icon} />
                    </KPI.Icon>
                  ) : null}
                  <KPI.Title className="truncate">{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <KPI.Value value={k.value} className="truncate tabular">
                    {() => (
                      <span title={shown === exact ? undefined : exact}>
                        <span aria-hidden={shown === exact ? undefined : true}>{shown}</span>
                        {shown === exact ? null : <span className="sr-only">{exact}</span>}
                      </span>
                    )}
                  </KPI.Value>
                </KPI.Content>
                {k.progress != null ? (
                  <KPI.Progress
                    value={Math.max(0, Math.min(100, k.progress))}
                    status={k.status}
                    aria-hidden="true"
                    className="mt-2"
                  />
                ) : null}
                {k.spark && k.spark.length > 1 ? (
                  <KPI.Chart
                    aria-hidden="true"
                    data={k.spark.map((value) => ({ value }))}
                    height={36}
                    color="var(--chart-cat-1)"
                    strokeWidth={2}
                    className="mt-2"
                  />
                ) : null}
                {k.trend || k.footnote ? (
                  <KPI.Footer className="mt-auto flex flex-col gap-1 pt-2">
                    {k.trend ? <Trend trend={k.trend} /> : null}
                    {k.footnote ? <p className="text-xs text-muted">{k.footnote}</p> : null}
                  </KPI.Footer>
                ) : null}
              </KPI>
            </Fragment>
          );
        })}
      </KPIGroup>
    </section>
  );
}
