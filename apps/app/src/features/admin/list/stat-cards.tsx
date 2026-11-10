"use client";

import { formatMoney, formatNumber, Icon, type IconKey, type KpiItem } from "@injishi/ui";
import NextLink from "next/link";
import type { ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type StatTone = "accent" | "success" | "warning" | "danger" | "neutral";

export interface Stat {
  id: string;
  label: string;
  value: number;
  /** "count" (default), whole francs, or a percent (0 to 100). */
  format?: "count" | "money" | "percent";
  /** A bar under the figure, 0 to 100. */
  progress?: number;
  /** The change against the period before, in percent. */
  trend?: number;
  icon: IconKey;
  /** The colour of the icon tile; a figure that needs someone is warning or danger. */
  tone?: StatTone;
  footnote?: ReactNode;
  /** The list it counts, filtered. */
  href?: string;
  /** The figure is the filter shown now. */
  isCurrent?: boolean;
}

const TILE: Record<StatTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-default text-muted",
};

/**
 * The admin console's figures (2026-11-09): each its own card with a tinted icon tile, a large figure and
 * a line under it; a card that opens its list lifts on hover, and the one shown now is outlined. Used for
 * the counts above every admin list and on the overview.
 */
export function StatCards({
  label,
  stats,
  columns = 5,
}: {
  label: string;
  stats: readonly Stat[];
  columns?: 3 | 4 | 5;
}) {
  const grid =
    columns === 3
      ? "sm:grid-cols-3"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3 xl:grid-cols-5";
  return (
    <section aria-label={label} className={cx("grid grid-cols-2 gap-3", grid)}>
      {stats.map((s) => {
        const tone = s.tone ?? "accent";
        const value =
          s.format === "money"
            ? formatMoney(s.value, { compact: Math.abs(s.value) >= 1_000_000 })
            : s.format === "percent"
              ? `${formatNumber(s.value, { maximumFractionDigits: 1 })}%`
              : formatNumber(s.value);
        const body = (
          <>
            <span className="flex items-center gap-2.5">
              <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", TILE[tone])}>
                <Icon name={s.icon} className="size-[18px]" />
              </span>
              <span className="min-w-0 text-sm leading-tight font-medium text-muted">{s.label}</span>
            </span>
            <span className="mt-3 flex items-baseline gap-2">
              <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-foreground tabular">
                {value}
              </span>
              {s.trend !== undefined && s.trend !== 0 ? (
                <span className={cx("text-xs font-medium", s.trend > 0 ? "text-success" : "text-danger")}>
                  {s.trend > 0 ? "▲" : "▼"} {Math.abs(s.trend)}%
                </span>
              ) : null}
            </span>
            {s.progress !== undefined ? (
              <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-default" aria-hidden>
                <span
                  className={cx("block h-full rounded-full", BAR[tone])}
                  style={{ width: `${Math.max(0, Math.min(100, s.progress))}%` }}
                />
              </span>
            ) : null}
            {s.footnote ? <span className="mt-1.5 block truncate text-xs text-muted">{s.footnote}</span> : null}
          </>
        );
        const shell = cx(
          "relative flex min-w-0 flex-col rounded-2xl border bg-surface p-4 shadow-xs transition",
          s.isCurrent ? "border-accent ring-1 ring-accent" : "border-separator",
          s.href &&
            "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent",
        );
        return s.href ? (
          <NextLink
            key={s.id}
            href={s.href}
            scroll={false}
            className={shell}
            aria-current={s.isCurrent ? "true" : undefined}
          >
            {body}
          </NextLink>
        ) : (
          <div key={s.id} className={shell}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

const BAR: Record<StatTone, string> = {
  accent: "bg-accent",
  neutral: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const MARK: Record<string, string> = {
  hospitality: "bg-accent-soft text-accent",
  residence: "bg-warning-soft text-warning",
  enterprise: "bg-success-soft text-success",
  person: "bg-default text-foreground",
};

/** A small square with a name's initials, tinted by kind: the face of a row in an admin list. */
export function EntityMark({ name, kind = "person" }: { name: string; kind?: string }) {
  const initials =
    name
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-xl text-xs font-semibold",
        MARK[kind] ?? MARK.person,
      )}
    >
      {initials}
    </span>
  );
}

/** The shared `KpiItem` figures shown as admin stat cards. */
export function KpiCards({ label, items }: { label: string; items: readonly KpiItem[] }) {
  return (
    <StatCards
      label={label}
      columns={items.length <= 3 || items.length === 6 ? 3 : items.length === 4 ? 4 : 5}
      stats={items.map((k) => ({
        id: k.id,
        label: k.label,
        value: k.value,
        format: k.format ?? "money",
        icon: k.icon ?? "Persons",
        tone: k.status ?? "accent",
        footnote: k.footnote,
        href: k.href,
        isCurrent: k.isCurrent,
        progress: k.progress,
        trend: k.trend?.percent,
      }))}
    />
  );
}
