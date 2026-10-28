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

function valueText(k: KpiItem, exact: boolean, compactFrom = 1_000_000): string {
  const format = k.format ?? "money";
  if (format === "percent") return `${formatNumber(k.value, { maximumFractionDigits: 1 })}%`;
  if (format === "count") return formatNumber(k.value);
  const compact = !exact && k.compact !== false && Math.abs(k.value) >= compactFrom;
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

const TONE_TEXT: Record<NonNullable<KpiItem["status"]>, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
const TONE_DOT: Record<NonNullable<KpiItem["status"]>, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * The figures at the top of a page, as one panel split into cells (two to a row on a phone, all in one
 * row from lg up). Each cell reads top down: a small icon and the label, the number large, then one
 * muted line, with a thin progress bar or a small trend line when the figure has one. No coloured
 * blocks: a figure that needs attention gets a coloured dot and number, and a cell that opens a list
 * shows an arrow on hover; the one shown now is underlined in the accent. Every figure carries its
 * exact value for screen readers; trends say which way is good.
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
      <div
        className={cx("grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-separator bg-separator", cols)}
      >
        {items.map((k, i) => {
          // Five or more to a row leave a cell too narrow for "RWF 183,000": compact from 100K there.
          const shown = valueText(k, false, items.length >= 5 ? 100_000 : 1_000_000);
          const exact = valueText(k, true);
          const showSpark = k.spark && k.spark.length > 1 && k.spark.some((v) => v > 0) && k.progress == null;
          const showProgress = k.progress != null && k.progress > 0 && k.progress < 100;
          return (
            <KPI
              key={k.id}
              className={cx(
                "group relative min-w-0 gap-0 rounded-none border-0 bg-surface px-5 py-4 shadow-none transition-colors",
                odd && i === items.length - 1 && "col-span-2 lg:col-span-1",
                k.href && "hover:bg-default/50",
                k.isCurrent && "bg-accent-soft/30",
              )}
            >
              {k.isCurrent ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" /> : null}
              <div className="flex min-w-0 items-center gap-1.5">
                {k.icon ? (
                  <Icon
                    name={k.icon}
                    aria-hidden="true"
                    className={cx("size-4 shrink-0", k.isCurrent ? "text-accent" : "text-muted")}
                  />
                ) : null}
                <KPI.Title
                  className={cx(
                    "min-w-0 flex-1 truncate text-[13px] font-medium",
                    k.isCurrent ? "text-accent" : "text-muted",
                  )}
                >
                  {k.label}
                </KPI.Title>
                {k.href ? (
                  <Icon
                    name="ArrowRight"
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                ) : null}
              </div>
              <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  {k.status && k.status !== "success" ? (
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", TONE_DOT[k.status])} />
                  ) : null}
                  <KPI.Value
                    value={k.value}
                    className={cx(
                      "truncate text-[28px] leading-none font-semibold tracking-tight tabular",
                      k.status && k.status !== "success" ? TONE_TEXT[k.status] : "text-foreground",
                    )}
                  >
                    {() => (
                      <span title={shown === exact ? undefined : exact}>
                        <span aria-hidden={shown === exact ? undefined : true}>{shown}</span>
                        {shown === exact ? null : <span className="sr-only">{exact}</span>}
                      </span>
                    )}
                  </KPI.Value>
                </span>
                {showSpark ? (
                  <KPI.Chart
                    aria-hidden="true"
                    data={(k.spark ?? []).map((value) => ({ value }))}
                    height={28}
                    color="var(--chart-cat-1)"
                    strokeWidth={1.75}
                    className="hidden w-16 shrink-0 sm:block"
                  />
                ) : null}
              </div>
              {showProgress ? (
                <KPI.Progress
                  value={Math.max(0, Math.min(100, k.progress ?? 0))}
                  status={k.status}
                  aria-hidden="true"
                  className="mt-3 h-1"
                />
              ) : null}
              {k.trend || k.footnote ? (
                <KPI.Footer className="mt-2.5 flex flex-col gap-1">
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
                  className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
                />
              ) : null}
            </KPI>
          );
        })}
      </div>
    </section>
  );
}
