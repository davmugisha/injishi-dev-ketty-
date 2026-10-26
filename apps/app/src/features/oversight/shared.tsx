"use client";

import { Card, Chip, ProgressBar } from "@heroui/react";
import type { Tone } from "@injishi/data/fixtures/oversight";
import { toneColor } from "@injishi/ui";
import type { Key, ReactNode } from "react";

/** Underline tabs sized to their label (artifact: .ij-tabs-line / .ij-tab — 40px high, 12px side padding). */
export const LINE_TAB = "h-10 w-auto flex-none gap-2 px-3 text-[14px]";
/** Tab list spacing of the underline tabs (artifact: 4px). */
export const LINE_LIST = "gap-1";

/** Small soft status chip for a semantic tone (artifact: chip chip--{tone} chip--soft chip--sm). */
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

/** Count badge inside a tab label (artifact: .ij-tab + chip chip--sm chip--soft chip--default). */
export function TabCount({ children }: { children: ReactNode }) {
  return (
    <Chip size="sm" variant="soft" className="ml-0.5 tabular">
      {children}
    </Chip>
  );
}

/** Card title as an h2: the artifact's cards are page sections (h1 → h2), while Card.Title defaults to h3. */
export function CardHeading({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <Card.Title
      id={id}
      className={`text-[15px] leading-[22px] font-semibold ${className ?? ""}`}
      render={(props) => <h2 {...props} />}
    >
      {children}
    </Card.Title>
  );
}

/** Section title inside a card that is not a heading in the artifact (artifact: span.ij-section-title at 14px). */
export function InlineTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`text-[14px] leading-[22px] font-semibold ${className ?? ""}`}>{children}</span>;
}

/** Grid of facts: muted label, value and an optional muted note (artifact: dl in an auto-fit grid). */
export function FactGrid({
  items,
  min,
  className,
}: {
  items: { id?: string; label: string; value: ReactNode; note?: ReactNode }[];
  /** Minimum column width in px (artifact: minmax(min(<min>px, 100%), 1fr)). */
  min: 150 | 180 | 200;
  className?: string;
}) {
  const cols = {
    150: "[grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]",
    180: "[grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]",
    200: "[grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]",
  }[min];
  return (
    <dl className={`grid ${cols} ${className ?? ""}`}>
      {items.map((f) => (
        <div key={f.id ?? f.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[12px] leading-4 text-muted">{f.label}</dt>
          <dd className="text-[13px] leading-[18px] font-medium">{f.value}</dd>
          {f.note ? <dd className="text-[12px] leading-4 text-muted">{f.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Thin horizontal bar (artifact: .ij-hbar, 8px, chart-3 fill), as a ProgressBar. */
export function HBar({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <ProgressBar value={value} size="sm" aria-label={label} className={className}>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

/** First key of a single-selection collection (tables, lists). */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}
