"use client";

import { Chip, Label, ProgressBar } from "@heroui/react";
import { KPIGroup } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import type { Tone } from "@injishi/data/fixtures/platformops";
import { formatNumber, formatRwf, toneColor } from "@injishi/ui";
import { Fragment, type Key, type ReactNode } from "react";

/** "RWF 120,000". */
export function money(value: number): string {
  return formatRwf(value);
}

/** Grouped count ("1,352"). */
export function count(value: number): string {
  return formatNumber(value);
}

/** Underline tabs sized to their label (artifact: ij-tabs-line). */
export const lineTab = "h-10 w-auto flex-none gap-2 px-2 text-sm whitespace-nowrap";

/** Table rows that act as a master list. */
export const selectableRow = "cursor-pointer";

export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ToneChip({
  tone,
  children,
  className,
}: {
  tone: Tone | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Chip size="sm" variant="soft" color={toneColor(tone)} className={className}>
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

export function KpiStrip({
  label,
  items,
  itemClassName = "min-w-[170px] flex-[1_1_170px]",
}: {
  label: string;
  items: { id: string; label: string; value: string; foot: string }[];
  itemClassName?: string;
}) {
  return (
    <section aria-label={label}>
      <KPIGroup className="flex-wrap">
        {items.map((k, i) => (
          <Fragment key={k.id}>
            {i > 0 ? <KPIGroup.Separator /> : null}
            <KPI className={itemClassName}>
              <KPI.Header>
                <KPI.Title>{k.label}</KPI.Title>
              </KPI.Header>
              <KPI.Content className="flex-none">
                <KPI.Value value={0} className="tabular">
                  {() => k.value}
                </KPI.Value>
              </KPI.Content>
              <KPI.Footer>
                <p className="mt-1.5 text-xs leading-4 text-muted">{k.foot}</p>
              </KPI.Footer>
            </KPI>
          </Fragment>
        ))}
      </KPIGroup>
    </section>
  );
}

/** Thin bar (artifact: ij-hbar) rendered as a progress bar. */
export function HBar({
  value,
  label,
  color = "accent",
}: {
  value: number;
  label: string;
  color?: "accent" | "success" | "warning" | "danger";
}) {
  return (
    <ProgressBar value={value} size="sm" color={color} aria-label={label}>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Label id={id} className="text-[13px]">
      {children}
    </Label>
  );
}
