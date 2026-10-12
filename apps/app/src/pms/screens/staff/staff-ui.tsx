"use client";

/**
 * Small pieces the Staff lenses share (ADR-058). Nothing here reads data or
 * decides a permission; each lens does both itself.
 */

import type { TagTone } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

/**
 * Bring what a row's button opened into view, and put the cursor in it.
 *
 * A list's forms are drawn above the list (Change pay, Correct, Mark paid).
 * Pressed from a row far down a long list, the form opened above the window:
 * the press looked as if it had done nothing. Whatever is inside this is
 * scrolled to when it appears, and again when `when` changes, which is the row
 * it was opened for. Something already in view does not move.
 */
export function Reveal({ when, children }: { when?: unknown; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // The first thing to type in, never a hidden input behind a select or a file button.
    el.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]):not([tabindex='-1']), textarea")?.focus({ preventScroll: true });
  }, [when]);
  return (
    <div ref={box} className="scroll-my-4">
      {children}
    </div>
  );
}

/**
 * Whether the window is narrower than a list's every column needs.
 *
 * A list that would scroll sideways on a small laptop starts with fewer
 * columns there, and the rest stay one press away under Columns. False on the
 * server and on the first render, so the two agree; a list somebody has
 * already chosen columns for keeps their choice either way.
 */
export function useNarrowScreen(maxWidth: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const read = () => setNarrow(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, [maxWidth]);
  return narrow;
}

/** Minutes as hours and minutes: `7 h 05`, `45 min`. */
export function hoursText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
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

/** A tag's tone as a badge intent: the five tones are five of the badge's six intents. */
export function toneIntent(tone: TagTone): "neutral" | "info" | "ok" | "warn" | "bad" {
  return tone;
}

/** One person a picker offers: their file id, the name to show, and what tells namesakes apart. */
export interface PersonOption {
  id: string;
  label: string;
  detail?: string | null;
}

/**
 * Choose several people from a list, with a search over it (058-people-file:
 * a document request, a disciplinary record, a policy's audience). A list of
 * checkboxes rather than a dropdown, so the choice stays in view while it grows.
 */
export function PeoplePicker({
  people,
  selected,
  onChange,
  label,
}: {
  people: readonly PersonOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** The group's accessible name, as a sentence: "People to ask". */
  label: string;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) => p.label.toLowerCase().includes(needle) || (p.detail ?? "").toLowerCase().includes(needle))
    : people;
  const chosen = new Set(selected);
  const toggle = (id: string, on: boolean) => onChange(on ? [...chosen, id] : [...chosen].filter((x) => x !== id));

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label={`Search: ${label}`}
        placeholder="Search by name"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        className={inputClass}
      />
      <div role="group" aria-label={label} className="max-h-56 overflow-y-auto rounded border border-line2 bg-card px-3 py-2">
        {shown.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">Nobody matches that.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {shown.map((p) => (
              <Checkbox
                key={p.id}
                isSelected={chosen.has(p.id)}
                onChange={(on) => toggle(p.id, on)}
                className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
              >
                {p.label}
                {p.detail && <span className="text-2xs text-muted-foreground">{p.detail}</span>}
              </Checkbox>
            ))}
          </div>
        )}
      </div>
      <span className="pms-num text-2xs text-muted-foreground">
        {chosen.size === 0 ? "Nobody chosen yet" : `${chosen.size} chosen`}
      </span>
    </div>
  );
}
