"use client";

/**
 * Small pieces the lenses of My work share (ADR-058, 058-self-service).
 * Nothing here reads data: each lens does that itself, for the one file it is
 * given.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "../../components/ui";
import { addDaysIso, dayPartsIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";

/**
 * The caller's own staff file at the business in view, or null when HR keeps
 * none for them. From the grant, where `fetchMyWorkspaces` put it.
 */
export function useMyFileId(): string | null {
  const { state } = usePms();
  return currentGrant(state)?.employeeId ?? null;
}

/** The Monday of the week a day falls in: a working week here runs Monday to Sunday. */
export function mondayOf(iso: string): string {
  return addDaysIso(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
}

/** `Mon 05 Oct`. */
export function dayText(iso: string): string {
  const { wd, dd, mon } = dayPartsIso(iso);
  return `${wd} ${dd} ${mon}`;
}

/** `October 2026` from `2026-10`. */
export function monthText(period: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${period}-01T00:00:00Z`),
  );
}

/** A month, some months on or back: `2026-10` and -1 is `2026-09`. */
export function shiftMonth(period: string, by: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The last day of a month, as a date. */
export function monthEnd(period: string): string {
  return addDaysIso(`${shiftMonth(period, 1)}-01`, -1);
}

/** The card a part of the page sits in. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-card border border-card-bd bg-card", className)}>{children}</section>;
}

/** What a lens shows while its first read is on the wire. */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 96 : 64} delay={i * 60} />
      ))}
    </div>
  );
}
