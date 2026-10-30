"use client";

/*
 * The Finance helpers Pay's two screens draw (payments and reconciliation), copied from `./shared.tsx` so Pay's
 * move takes whole files (ADR-074 stage 6). Finance keeps the original.
 */

import { CircleCheckFill, CircleDashed, CircleExclamationFill, CircleXmarkFill } from "@gravity-ui/icons";
import { Chip } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import type { CheckTone, FinanceEvent, Tone } from "@injishi/data/fixtures/finance";
import { formatRwf, toneColor } from "@injishi/ui";
import type { ReactNode } from "react";

/** "RWF 118,400"; negatives use a true minus sign, as the design does ("−RWF 3,500"). */
export function money(value: number): string {
  return formatRwf(value).replace(/^-/, "−");
}

/** Table rows that act as a master list: the selected row takes the accent tint (artifact: data-selected rows). */
export const selectableRow = "cursor-pointer data-[selected=true]:*:bg-accent-soft";

/** Underline tabs sized to their label, left-aligned (artifact: ij-tabs-line). */
export const lineTab = "w-auto whitespace-nowrap";

const CHECK_ICONS = {
  success: { Icon: CircleCheckFill, className: "text-success" },
  warning: { Icon: CircleExclamationFill, className: "text-warning" },
  danger: { Icon: CircleXmarkFill, className: "text-danger" },
  idle: { Icon: CircleDashed, className: "text-muted" },
} as const;

/** Outcome icon of an evidence check (filled check, exclamation, cross, or a dashed circle when not run yet). */
export function CheckIcon({ tone, className = "mt-0.5 size-4 shrink-0" }: { tone: CheckTone; className?: string }) {
  const { Icon, className: color } = CHECK_ICONS[tone];
  return <Icon aria-hidden="true" className={`${color} ${className}`} />;
}

/** Compact history timeline (artifact: timeline--sm timeline--compact). */
export function EventTimeline({ events }: { events: FinanceEvent[] }) {
  return (
    <Timeline size="sm" density="compact">
      {events.map((e) => (
        <Timeline.Item key={`${e.title}-${e.meta}`} status={e.status}>
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
export function TabCount({ count }: { count: number }) {
  return (
    <Chip size="sm" className="ml-1.5 tabular">
      {count}
    </Chip>
  );
}

/** Sub-heading inside a card (artifact: 13px semibold h3). */
export function SubHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="text-[13px] leading-[18px] font-semibold">
      {children}
    </h3>
  );
}
