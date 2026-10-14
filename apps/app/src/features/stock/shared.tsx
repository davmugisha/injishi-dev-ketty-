"use client";

import { Chip, ProgressBar } from "@heroui/react";
import type { Tone } from "@injishi/data/fixtures/stock";
import { formatNumber, formatRwf, toneColor } from "@injishi/ui";
import type { ReactNode } from "react";

/** "RWF 118,400"; negatives use a true minus sign, as the design does ("−RWF 3,445"). */
export function money(value: number): string {
  return formatRwf(Math.round(value)).replace(/^-/, "−");
}

/** "+RWF 3,300" / "−RWF 98,000" / "RWF 0": amounts that are a difference. */
export function signedMoney(value: number): string {
  const v = Math.round(value);
  if (v > 0) return `+${formatRwf(v)}`;
  return money(v);
}

/** "+3 kg" / "−14" / "0": a signed quantity with an optional unit. */
export function signedQty(value: number, unit?: string | null): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const n = formatNumber(Math.abs(value), { maximumFractionDigits: 2 });
  return `${sign}${n}${unit ? ` ${unit}` : ""}`;
}

/** A quantity with its unit, e.g. "46 L" or "52". */
export function qty(value: number, unit?: string | null): string {
  return `${formatNumber(value, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

/** Underline tabs sized to their label, left-aligned (artifact: ij-tabs-line). */
export const lineTab = "w-auto whitespace-nowrap";

/** Table rows that act as a master list: the selected row takes the accent tint (artifact: data-selected rows). */
export const selectableRow = "cursor-pointer data-[selected=true]:*:bg-accent-soft";

/** Count badge inside a tab label (artifact: ij-tab + chip--sm). */
export function TabCount({ children }: { children: ReactNode }) {
  return (
    <Chip size="sm" className="ml-1.5 tabular">
      {children}
    </Chip>
  );
}

/** Small soft status chip for a semantic tone. */
export function ToneChip({
  tone,
  children,
  size = "sm",
  className,
}: {
  tone: Tone | null | undefined;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Chip size={size} variant="soft" color={toneColor(tone)} className={className}>
      {children}
    </Chip>
  );
}

/** Thin horizontal bar (artifact: ij-hbar), e.g. on-hand against par or a share of stock value. */
export function Bar({
  value,
  label,
  color = "accent",
  className,
}: {
  value: number;
  label: string;
  color?: "accent" | "warning" | "danger" | "success" | "default";
  className?: string;
}) {
  return (
    <ProgressBar value={value} size="sm" color={color} aria-label={label} className={className}>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

/** Small muted helper line (artifact: ij-muted 12px). */
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs leading-4 text-muted ${className ?? ""}`}>{children}</span>;
}

/** Label/value rows with values pushed right (artifact: ij-kv with `grid-template-columns: 1fr auto`). */
export function KvRows({
  items,
  footer,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; key?: string }[];
  /** Emphasised last row, e.g. a total. */
  footer?: { label: ReactNode; value: ReactNode };
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[13px] leading-5 ${className ?? ""}`}>
      {items.map((it, i) => (
        <div key={it.key ?? i} className="contents">
          <dt className="text-muted">{it.label}</dt>
          <dd className="text-right font-medium tabular">{it.value}</dd>
        </div>
      ))}
      {footer ? (
        <div className="contents">
          <dt className="font-semibold text-foreground">{footer.label}</dt>
          <dd className="text-right font-medium tabular">{footer.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Heading of a section with a muted line under it (artifact: ij-section-title + 12px muted). */
export function SectionTitle({
  id,
  title,
  children,
  as: Heading = "h2",
}: {
  id?: string;
  title: ReactNode;
  children?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Heading id={id} className="text-[15px] leading-[22px] font-semibold">
        {title}
      </Heading>
      {children ? <Muted>{children}</Muted> : null}
    </div>
  );
}
