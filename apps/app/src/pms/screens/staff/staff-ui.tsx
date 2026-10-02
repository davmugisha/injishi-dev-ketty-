"use client";

/**
 * Small pieces the Staff lenses share (ADR-058). Nothing here reads data or
 * decides a permission; each lens does both itself.
 */

import type { ReactNode } from "react";

import { ApiError, humanError } from "../../data/api";
import { TIMEZONE } from "../../lib/format";

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

/** The skin every text, date and time input on these screens wears. */
export const inputClass = "h-10 w-full rounded border-line2 bg-card text-sm";

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

/** The blockers a refused pay run confirm carried, if that is what this was. */
export function blockersOf(error: unknown): { employeeId: string; message: string }[] {
  if (!(error instanceof ApiError)) return [];
  const body = error.body as { blockers?: { employeeId: string; message: string }[] } | null;
  return Array.isArray(body?.blockers) ? body.blockers : [];
}

/** `07:45`, the wall clock in Kigali, from an instant. */
export function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Days as a person says them: `1 day`, `1.5 days`. */
export function daysText(days: number): string {
  const n = Number.isInteger(days) ? String(days) : days.toFixed(1);
  return `${n} day${days === 1 ? "" : "s"}`;
}

/** An instant as the value a `datetime-local` input takes, in Kigali. */
export function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** A `datetime-local` value read as Kigali wall clock, back to an instant. */
export function fromLocalInput(value: string): string {
  // Rwanda keeps UTC+2 all year, which is also what the API assumes.
  return new Date(`${value}:00+02:00`).toISOString();
}
