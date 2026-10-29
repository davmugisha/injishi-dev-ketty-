"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { StatusDot, type Tone } from "@injishi/ui";
import { type ReactNode, useCallback } from "react";
import type { CancellationTier, RoomStatus } from "../../model/frontdesk.ts";
import { useBoardHref } from "../mount.tsx";

/**
 * Single-choice HeroUI Select over plain string options (artifact: select__trigger). Shows a visible
 * label when `label` is given, otherwise pass `aria-label`.
 */
export function ChoiceSelect({
  label,
  options,
  value,
  onChange,
  indicator,
  className,
  "aria-label": ariaLabel,
}: {
  label?: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  /** Replaces the chevron (e.g. a calendar icon for date pickers). */
  indicator?: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      aria-label={label ? undefined : ariaLabel}
      value={value}
      onChange={(k) => (k == null ? null : onChange(String(k)))}
      className={className ?? "flex flex-col gap-1"}
    >
      {label ? <Label>{label}</Label> : null}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator>{indicator}</Select.Indicator>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Housekeeping status → chip tone and label (artifact: RS map). */
export const ROOM_STATUS: Record<RoomStatus, { tone: Tone; label: string }> = {
  dirty: { tone: "warning", label: "Dirty" },
  clean: { tone: "success", label: "Clean" },
  inspected: { tone: "success", label: "Inspected" },
  occupied: { tone: "default", label: "Occupied" },
  ooo: { tone: "danger", label: "Out of order" },
};

/** Only clean or inspected rooms can be assigned or checked into. */
export function isReady(status: RoomStatus | null | undefined): boolean {
  return status === "clean" || status === "inspected";
}

/**
 * Where a booking opens: the reservations list with that booking selected in the inspector, which reads
 * the booking from the API. The full reservation record (/reservations/[id]) is still the prototype's
 * sample (frontdesk.reservationRecords is deferred), so a booking is never routed there by its reference.
 */
export function useBookingHref(): (bookingId: string) => string {
  const screenHref = useBoardHref();
  return useCallback(
    (bookingId: string) => `${screenHref("Reservations")}?booking=${encodeURIComponent(bookingId)}`,
    [screenHref],
  );
}

/** "1 night" / "2 nights". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cancellation policy tiers with the tier that applies today highlighted (artifact: tier list). */
export function PolicyTiers({ tiers, current, label }: { tiers: CancellationTier[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-1 text-xs">
      {tiers.map((t, i) => {
        const on = i === current;
        return (
          <li
            key={t.id}
            aria-current={on ? "true" : undefined}
            className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 ${on ? "bg-warning-soft font-semibold" : ""}`}
          >
            <StatusDot tone={on ? "warning" : "default"} />
            <span className="flex-1">{t.label}</span>
            <span className="font-normal text-muted">{t.rule}</span>
          </li>
        );
      })}
    </ol>
  );
}
