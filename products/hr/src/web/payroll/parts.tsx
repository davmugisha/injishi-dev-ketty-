"use client";

import { ItemCard } from "@heroui-pro/react";
import { PieChart } from "@heroui-pro/react/pie-chart";
import type { ReactNode } from "react";
import { rwf } from "./pay-calc";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** One row of an amount breakdown; totals are emphasised. */
export interface AmountRow {
  /** Unique within its list (also the row key). */
  label: string;
  value: ReactNode;
  total?: boolean;
}

/** Label/amount breakdown with right-aligned figures (artifact: .ij-kv with `minmax(0, 1fr) max-content`). */
export function AmountList({ rows, className }: { rows: AmountRow[]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2 text-[13px] leading-5", className)}>
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className={row.total ? "font-semibold text-foreground" : "text-muted"}>{row.label}</dt>
          <dd className={cx("text-right tabular", row.total ? "font-semibold" : "font-medium")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A selectable row of an ItemCardGroup. HeroUI's documented "pressable ItemCard" composition
 * (item-card-group docs): the card renders as a native button and reports its pressed state.
 */
export function PressableItemCard({
  isSelected,
  onPress,
  className,
  children,
}: {
  isSelected: boolean;
  onPress: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ItemCard<"button">
      aria-pressed={isSelected}
      onClick={onPress}
      className={cx(
        "relative w-full cursor-pointer items-start border-t border-separator text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        isSelected ? "bg-accent-soft" : "hover:bg-default/40",
        className,
      )}
      render={(props) => <button type="button" {...props} />} // heroui-ok: HeroUI's documented pressable ItemCard
    >
      {children}
    </ItemCard>
  );
}

/**
 * A tab for a file whose link is still being made. Opened inside the press, before any wait, so the browser
 * treats it as the click's own window and does not block it; the link follows, or the tab closes.
 */
export function openPendingTab() {
  const tab = window.open("", "_blank");
  return {
    opened: tab !== null,
    go(url: string) {
      if (!tab) {
        window.location.assign(url);
        return;
      }
      tab.opener = null;
      tab.location.href = url;
    },
    close() {
      tab?.close();
    },
  };
}

/**
 * A person's pay as a ring: what they take home, and what is taken from it. `other` is a line's own
 * deductions; without it (a whole run) they are what the gross does not explain.
 */
export function LineDonut({
  gross,
  net,
  paye,
  rssb,
  other,
}: {
  gross: number;
  net: number;
  paye: number;
  rssb: number;
  other?: number;
}) {
  const parts = [
    { id: "net", label: "Take-home", value: net, color: "var(--chart-1)" },
    { id: "paye", label: "PAYE", value: paye, color: "var(--chart-4)" },
    { id: "rssb", label: "RSSB", value: rssb, color: "var(--chart-5)" },
    {
      id: "other",
      label: "Other",
      value: other ?? Math.max(0, gross - net - paye - rssb),
      color: "var(--chart-other)",
    },
  ].filter((p) => p.value > 0);
  // Money paid on top of the gross makes the take-home larger than it, so the ring is of everything paid out.
  const whole = parts.reduce((t, p) => t + p.value, 0);
  if (whole <= 0) return null;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface-secondary p-3">
      <div className="relative size-[132px] shrink-0">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">Take-home</span>
          <span className="text-[15px] font-semibold">{Math.round((Math.max(0, net) / whole) * 100)}%</span>
        </div>
        <PieChart height={132} width={132}>
          <PieChart.Pie
            data={parts}
            dataKey="value"
            nameKey="label"
            innerRadius={44}
            outerRadius={62}
            paddingAngle={2}
            cornerRadius={3}
            stroke="var(--surface)"
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {parts.map((p) => (
              <PieChart.Cell key={p.id} fill={p.color} />
            ))}
          </PieChart.Pie>
        </PieChart>
      </div>
      <dl className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        {parts.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <dt className="flex-1 text-muted">{p.label}</dt>
            <dd className="font-medium tabular">{rwf(p.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
