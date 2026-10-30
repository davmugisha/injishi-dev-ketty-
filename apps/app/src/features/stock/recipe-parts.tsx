"use client";

import { Chip } from "@heroui/react";
import type { Tone } from "@injishi/data/fixtures/stock";
import { formatRwf, toneColor } from "@injishi/ui";
import type { ReactNode } from "react";

/*
 * The stock helpers recipes draws. They were `./shared`, which the store, the stock ledger, purchase orders and
 * goods receipt keep until they move with POS; recipes moves with Outlets in ADR-074 stage 5.
 */

/** "RWF 118,400"; negatives use a true minus sign, as the design does ("−RWF 3,445"). */
export function money(value: number): string {
  return formatRwf(Math.round(value)).replace(/^-/, "−");
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
