"use client";

/**
 * Small pieces the HR and My HR lenses share. Nothing here reads data or
 * decides a permission; each lens does both itself.
 *
 * `Field`, `inputClass`, `RowList`, `rowClass`, `FormError`, `daysText`,
 * `clock` and `hoursText` are
 * the same pieces, under the same names, as `screens/staff/staff-ui.tsx` on
 * main (ADR-058), which this branch was cut before. They are copied here so
 * these screens wear the same skin as the Staff lenses; once main is merged,
 * import them from there and delete the copies.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Badge, Initials } from "../components/ui";
import { humanError } from "../data/api";
import type { DayStatus, Shift } from "../data/hr-time";
import type { PayAttendance, PayslipLine } from "../data/payslip";
import { TIMEZONE, dayPartsIso, dshortIso, fmt, initials } from "../lib/format";

/** A labelled field. The label is a real `<label>`, so a click focuses the input. */
export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
        {label}
      </label>
      {children}
      {hint && <span className="text-2xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** The skin every text, date and number input on these screens wears. */
export const inputClass = "h-10 w-full rounded border-line2 bg-card text-sm";

/** The same skin for a figure typed inside a row: short, and right aligned like the column it sits in. */
export const figureInputClass = "h-9 w-20 rounded border-line2 bg-card text-right text-sm";

/** The card a form, a chart or a block of figures sits in. */
export const panelClass = "rounded-card border border-card-bd bg-card";

/** The card a list of rows sits in. */
export function RowList({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 overflow-hidden rounded-card border border-card-bd bg-card">{children}</div>;
}

/** One row of a `RowList`. The first row carries no rule above it. */
export function rowClass(index: number): string {
  return index === 0 ? "border-t border-transparent px-[18px] py-3" : "border-t border-line px-[18px] py-3";
}

/** A form's refusal, in the server's own words when it wrote some. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {humanError(error)}
    </p>
  );
}

/** A refusal this screen worded itself, such as a last day before the first. */
export function Refusal({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

/** The small uppercase line above a group inside a card. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">{children}</span>;
}

/**
 * A person in a row: their initials, their name, and the line that tells
 * namesakes apart. `children` sit beside the name, for a badge.
 */
export function Person({
  name,
  detail,
  children,
  className,
}: {
  name: string;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>
      <Initials size={32}>{initials(name)}</Initials>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {name}
          {children}
        </span>
        {detail ? <span className="text-2xs text-muted-foreground">{detail}</span> : null}
      </span>
    </span>
  );
}

/**
 * How much of something is used, as the one bar the charts draw: `chart-1`
 * over a `chart-track` of the same hue. The figure is always written beside
 * it by the caller, so the bar is never the only way to read it.
 */
export function Meter({
  label,
  value,
  max,
  over = false,
}: {
  /** The whole reading, as a sentence: "Annual leave: 4 of 18 days used". */
  label: string;
  value: number;
  max: number;
  /** Past the limit: the bar turns to the warning colour. */
  over?: boolean;
}) {
  const share = max > 0 ? Math.min(Math.max(value, 0) / max, 1) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="relative h-2.5 overflow-hidden rounded-r bg-chart-track"
    >
      <span
        className={cn("absolute inset-y-0 left-0 rounded-r", over ? "bg-warn" : "bg-chart-1")}
        style={{ width: `${share * 100}%`, minWidth: value > 0 ? 2 : 0 }}
      />
    </div>
  );
}

/** Opens and closes something that is rarely needed, so it stays out of the way until asked for. */
export function MoreToggle({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="w-fit cursor-pointer bg-transparent text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

/** Days as a person says them: `1 day`, `1.5 days`. */
export function daysText(days: number): string {
  const n = Number.isInteger(days) ? String(days) : days.toFixed(1);
  return `${n} day${days === 1 ? "" : "s"}`;
}

/** How many days a stretch covers, both ends counted. */
export function dayCount(r: { startDate: string; endDate: string }): number {
  return Math.round((Date.parse(r.endDate) - Date.parse(r.startDate)) / 86_400_000) + 1;
}

/** `05 Oct 2026`, or `05 Oct to 20 Oct 2026`, from two stored `YYYY-MM-DD` days. */
export function dayRange(r: { startDate: string; endDate: string }): string {
  const year = r.endDate.slice(0, 4);
  return r.startDate === r.endDate
    ? `${dshortIso(r.endDate)} ${year}`
    : `${dshortIso(r.startDate)} to ${dshortIso(r.endDate)} ${year}`;
}

/* ── Time: the roster and attendance ────────────────────────────────────── */

/** `07:45`, the wall clock in Kigali, from an instant. */
export function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Minutes as hours and minutes: `7 h 05`, `45 min`. */
export function hoursText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** `Thu 08 Oct`, from a stored day. */
export function weekdayText(day: string): string {
  const { wd, dd, mon } = dayPartsIso(day);
  return `${wd} ${dd} ${mon}`;
}

/** The colour a shift wears, from the step of the chart ramp it was given. */
export function shiftColor(shift: Pick<Shift, "colorSlot">): string {
  return `var(--chart-${Math.min(Math.max(shift.colorSlot, 1), 5)})`;
}

/** `07:00 to 15:00`. */
export function shiftHours(shift: Pick<Shift, "startTime" | "endTime">): string {
  return `${shift.startTime} to ${shift.endTime}`;
}

/**
 * A shift as a label: its colour as a bar at the leading edge, then its name
 * and hours in words. The colour is a second way to find it on a grid, never
 * the only one, since the five steps of one hue are close.
 */
export function ShiftChip({ shift, className }: { shift: Shift; className?: string }) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2 rounded border border-card-bd bg-card py-1 pr-2.5 pl-2", className)}
    >
      <span aria-hidden className="h-6 w-1 shrink-0 rounded-full" style={{ background: shiftColor(shift) }} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-2xs font-semibold text-ink">{shift.name}</span>
        <span className="pms-num text-2xs whitespace-nowrap text-muted-foreground">{shiftHours(shift)}</span>
      </span>
    </span>
  );
}

const STATUS: Record<DayStatus, { label: string; intent: "ok" | "warn" | "bad" | "info" | "neutral" }> = {
  working: { label: "At work", intent: "ok" },
  done: { label: "Finished", intent: "neutral" },
  missing: { label: "Not in", intent: "bad" },
  expected: { label: "Not started", intent: "neutral" },
  on_leave: { label: "On leave", intent: "info" },
  off: { label: "Day off", intent: "neutral" },
};

export const dayStatusLabel = (status: DayStatus): string => STATUS[status].label;

/** Where somebody stands on a day, as the one badge every time screen draws. */
export function DayStatusBadge({ status }: { status: DayStatus }) {
  return <Badge intent={STATUS[status].intent}>{STATUS[status].label}</Badge>;
}

/* ── Pay: what a payslip is made of ─────────────────────────────────────── */

/** Which part of the payslip a line sits in. The words are main's (`payroll-ui.tsx`). */
const SIDE_GROUP: Record<PayslipLine["side"], string> = {
  earning: "Earnings",
  employee: "Withheld",
  employer: "The business adds",
};

/** A line's amount as the payslip prints it: what is paid, what is taken off, what the business adds. */
export function lineAmount(line: Pick<PayslipLine, "side" | "amountRwf">): string {
  if (line.side === "earning") return line.amountRwf < 0 ? `${fmt(Math.abs(line.amountRwf))} off` : fmt(line.amountRwf);
  if (line.side === "employer") return fmt(line.amountRwf);
  return `− ${fmt(Math.abs(line.amountRwf))}`;
}

/** The month's roster and clock as the one sentence a payslip carries. Null when there was nothing to read. */
export function attendanceSentence(a: PayAttendance | null): string | null {
  if (!a || (a.rosteredDays === 0 && a.workedDays === 0 && a.unpaidLeaveDays === 0)) return null;
  const parts = [`${a.workedDays} of ${a.rosteredDays} rostered ${a.rosteredDays === 1 ? "shift" : "shifts"} worked`];
  if (a.missedDays > 0) parts.push(`${a.missedDays} missed`);
  if (a.unpaidLeaveDays > 0) parts.push(`${daysText(a.unpaidLeaveDays)} of unpaid leave`);
  if (a.lateDays > 0) parts.push(`${a.lateDays} late`);
  if (a.overtimeMinutes > 0) parts.push(`${hoursText(a.overtimeMinutes)} of overtime`);
  return parts.join(" · ");
}

/**
 * A payslip's lines, grouped as a payslip reads on paper. How each figure was
 * reached sits under its name, so the table is two columns at any width and
 * fits a phone as it fits a desk.
 */
export function PayslipLines({ lines }: { lines: readonly PayslipLine[] }) {
  const groups = (["earning", "employee", "employer"] as const)
    .map((side) => ({ side, lines: lines.filter((l) => l.side === side) }))
    .filter((g) => g.lines.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <table key={g.side} className="w-full text-sm">
          <caption className="pb-1 text-left text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
            {SIDE_GROUP[g.side]}
          </caption>
          <tbody>
            {g.lines.map((l, i) => (
              <tr key={`${l.code}-${i}`} className="border-b border-line last:border-b-0">
                <td className="py-1.5 pr-3 text-ink">
                  {l.label}
                  {l.basis && <span className="block text-2xs text-muted-foreground">{l.basis}</span>}
                </td>
                <td className="pms-num py-1.5 text-right align-top whitespace-nowrap text-ink2">{lineAmount(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
