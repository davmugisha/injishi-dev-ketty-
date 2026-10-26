"use client";

import { TrendChip } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import NextLink from "next/link";
import type { ReactNode } from "react";
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
  /** Where the figure clicks through to: the list it counts, filtered. */
  href?: string;
  /** The figure is the filter shown now. */
  isCurrent?: boolean;
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

const TONE_TINT: Record<NonNullable<KpiItem["status"]>, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/**
 * The figures at the top of a page: three to seven separate cards in one grid (two to a row on a phone,
 * all in one row from lg up), each with its label and icon, the number large, then a progress bar or a
 * small trend line and one muted line. A card that counts a list opens it; the one shown now is outlined.
 * Every figure carries its exact value for screen readers; trends say which way is good.
 */
export function KpiStrip({ label, items, className }: { label: string; items: KpiItem[]; className?: string }) {
  const odd = items.length % 2 === 1;
  const cols =
    items.length >= 5
      ? "lg:grid-cols-5"
      : items.length === 4
        ? "lg:grid-cols-4"
        : items.length === 3
          ? "lg:grid-cols-3"
          : "lg:grid-cols-2";
  return (
    <section aria-label={label} className={cx("min-w-0", className)}>
      <div className={cx("grid grid-cols-2 gap-3", cols)}>
        {items.map((k, i) => {
          const shown = valueText(k, false);
          const exact = valueText(k, true);
          return (
            <KPI
              key={k.id}
              className={cx(
                "group relative min-w-0 gap-0 rounded-xl border border-separator bg-surface p-4 shadow-none transition-[border-color,background-color]",
                odd && i === items.length - 1 && "col-span-2 lg:col-span-1",
                k.href && "hover:border-accent/40 hover:bg-default/40",
                k.isCurrent && "border-accent/60 bg-accent-soft/40",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                {k.icon ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      k.status ? TONE_TINT[k.status] : "bg-accent-soft text-accent",
                    )}
                  >
                    <Icon name={k.icon} className="size-5" />
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col">
                  <KPI.Title className="truncate text-xs font-medium text-muted">{k.label}</KPI.Title>
                  <KPI.Value
                    value={k.value}
                    className="truncate text-2xl leading-tight font-semibold tracking-tight tabular"
                  >
                    {() => (
                      <span title={shown === exact ? undefined : exact}>
                        <span aria-hidden={shown === exact ? undefined : true}>{shown}</span>
                        {shown === exact ? null : <span className="sr-only">{exact}</span>}
                      </span>
                    )}
                  </KPI.Value>
                </div>
                {k.spark && k.spark.length > 1 && k.spark.some((v) => v > 0) && k.progress == null ? (
                  <KPI.Chart
                    aria-hidden="true"
                    data={k.spark.map((value) => ({ value }))}
                    height={36}
                    color="var(--chart-cat-1)"
                    strokeWidth={2}
                    className="hidden w-20 shrink-0 sm:block"
                  />
                ) : null}
              </div>
              {k.progress != null && k.progress > 0 && k.progress < 100 ? (
                <KPI.Progress
                  value={Math.max(0, Math.min(100, k.progress))}
                  status={k.status}
                  aria-hidden="true"
                  className="mt-3"
                />
              ) : null}
              {k.trend || k.footnote ? (
                <KPI.Footer className="mt-3 flex flex-col gap-1 border-t border-separator pt-2.5">
                  {k.trend ? <Trend trend={k.trend} /> : null}
                  {k.footnote ? <p className="truncate text-xs text-muted">{k.footnote}</p> : null}
                </KPI.Footer>
              ) : null}
              {k.href ? (
                <NextLink
                  href={k.href}
                  scroll={false}
                  aria-label={`${k.label}: ${exact}. Show them`}
                  aria-current={k.isCurrent ? "true" : undefined}
                  className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              ) : null}
            </KPI>
          );
        })}
      </div>
    </section>
  );
}
