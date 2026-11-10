"use client";

import { Card, Chip, Label, ListBox, Select } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import type { EventStatus, Fact, Tone } from "@injishi/data/fixtures/admin";
import { formatNumber, formatRwf, toneColor } from "@injishi/ui";
import type { Key, ReactNode } from "react";

/** The prototype's "now": every admin board is set on Monday 12 October 2026 at 09:42 CAT. */
export const NOW = { hour: 9, minute: 42 };

/** "HH:MM" `minutes` after now (view-as session end times). */
export function clockAfter(minutes: number): string {
  const total = NOW.hour * 60 + NOW.minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "RWF 120,000"; negatives use a true minus sign, as the design does ("−RWF 80,000"). */
export function money(value: number): string {
  return formatRwf(value).replace(/^-/, "−");
}

/** Plain grouped amount ("480,000"). */
export function amount(value: number): string {
  return formatNumber(value);
}

/** Account-card compact amounts ("RWF 21.5M", "RWF 4.38M", "RWF 386K"). */
export function compactRwf(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const digits = millions >= 10 ? 1 : 2;
    const text = millions.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
    return `RWF ${text}M`;
  }
  if (abs >= 10_000) return `RWF ${Math.round(abs / 1_000)}K`;
  return money(value);
}

/** First key of a HeroUI selection, or null for an empty or "all" selection. */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

/** Two-letter initials of a name ("Samuel Nkusi" → "SN"). */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Underline tabs sized to their label, left-aligned (artifact: ij-tabs-line). */
export const lineTab = "w-auto whitespace-nowrap";

/** Table rows that act as a master list (artifact: data-selected rows). */
export const selectableRow = "cursor-pointer";

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

/** Count badge inside a tab label (artifact: ij-tab + chip--sm). */
export function TabCount({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <Chip size="sm" variant={tone ? "soft" : undefined} color={toneColor(tone)} className="ml-1.5 tabular">
      {children}
    </Chip>
  );
}

/** Card heading block: h2 title + description (artifact: card__header with a 15px title). */
export function CardHead({ id, title, description }: { id: string; title: ReactNode; description?: ReactNode }) {
  return (
    <Card.Header className="gap-0.5">
      <Card.Title id={id} className="text-[15px] leading-[22px] font-semibold" render={(p) => <h2 {...p} />}>
        {title}
      </Card.Title>
      {description ? <Card.Description>{description}</Card.Description> : null}
    </Card.Header>
  );
}

/** Sub-heading inside a card (artifact: 13px semibold h3). */
export function SubHeading({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h3 id={id} className={`text-[13px] leading-[18px] font-semibold ${className ?? ""}`}>
      {children}
    </h3>
  );
}

/** Label/value rows, value right-aligned (artifact: ij-row space-between, 13px). */
export function FactRows({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={`flex flex-col gap-2 ${className ?? ""}`}>
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px]">
          <dt className="text-muted">{f.label}</dt>
          <dd className="text-right font-medium tabular">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Two-column figures grid (artifact: ij-cols, label left, number right). */
export function FigureGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] leading-[18px] ${className ?? ""}`}>
      {facts.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-muted">{f.label}</dt>
          <dd className="text-right font-medium tabular">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Labelled single-choice select (artifact: label + select__trigger). */
export function OptionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select fullWidth value={value} onChange={(k) => (k == null ? undefined : onChange(String(k)))}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Compact event history (artifact: timeline--sm timeline--compact with status markers). */
export function EventTimeline({
  events,
}: {
  events: { key: string; title: ReactNode; meta: ReactNode; status: EventStatus }[];
}) {
  return (
    <Timeline size="sm" density="compact">
      {events.map((e) => (
        <Timeline.Item key={e.key} status={e.status}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-0.5">
            <span className="text-[13px] leading-[18px] font-medium">{e.title}</span>
            <span className="text-xs leading-4 text-muted tabular">{e.meta}</span>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/**
 * One row of a details card (2026-11-09): the label in a fixed column on the left, the value beside it, and an
 * optional chip pinned to the right edge, so labels, values and chips line up down the card. Wrap rows in a `dl`.
 */
export function FactRow({ label, chip, children }: { label: string; chip?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-separator py-3 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex min-h-6 items-center justify-between gap-3 text-sm">
        <span className="min-w-0 break-words">{children ?? <span className="text-muted">Not given</span>}</span>
        {chip ?? null}
      </dd>
    </div>
  );
}
