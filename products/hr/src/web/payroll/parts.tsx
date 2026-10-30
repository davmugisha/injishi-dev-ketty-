"use client";

import { ItemCard } from "@heroui-pro/react";
import type { ReactNode } from "react";

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
