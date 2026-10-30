// The overlay (mobile spec 0003, cross child contract 3): a screen never reads the outbox directly.
// It reads a query, and the unsent rows are laid over it, plus the sent rows the read has not caught
// up with yet (server time on both sides, D-aq), so a write shows the moment it is made and never
// flickers off. A refused row is never laid over. Pure, so `node --test` locks it.

import type { MyWorkToday } from "@injishi/contracts";
import { kigaliDate } from "../../lib/kigali.ts";
import type { OutboxRow } from "./types.ts";

/** The fields of a row the overlay reads. */
export type OverlayRow = Pick<OutboxRow, "id" | "seq" | "kind" | "subjectId" | "state" | "occurredAt" | "serverAt">;

/**
 * The `date` header has whole seconds, so a sent row counts as newer than a read made in the same
 * second. Laying it over once too often is harmless: each reducer leaves a state it already shows.
 */
const SERVER_DATE_SLACK_MS = 1000;

/** Does this row still belong over a read the server made at `generatedAt`? */
export function overlays(row: OverlayRow, generatedAt: string): boolean {
  if (row.state === "refused") return false;
  if (row.state !== "sent") return true;
  if (!row.serverAt) return false;
  return Date.parse(row.serverAt) + SERVER_DATE_SLACK_MS > Date.parse(generatedAt);
}

/** The shift card's read with the phone's own punches laid over it. */
export type TodayView = Omit<MyWorkToday, "openRecord"> & {
  openRecord: (NonNullable<MyWorkToday["openRecord"]> & { saved: boolean }) | null;
  /** The last clock out came from this phone and has not reached the server yet. */
  clockOutSaved: boolean;
};

/**
 * `clock_in` opens a record at the tap, marked "Saved on this phone" while unsent; `clock_out`
 * closes it at the tap. The tap is corrected by the clock offset the outbox learned, so a wrong phone
 * clock does not show a wrong time. Rows are applied in `seq` order.
 */
export function applyPendingToday(today: MyWorkToday, rows: readonly OverlayRow[], clockOffsetMs: number): TodayView {
  let view: TodayView = {
    ...today,
    openRecord: today.openRecord ? { ...today.openRecord, saved: false } : null,
    clockOutSaved: false,
  };
  const mine = rows
    .filter((row) => row.subjectId === today.employeeId && overlays(row, today.generatedAt))
    .sort((a, b) => a.seq - b.seq);
  for (const row of mine) {
    const tapMs = Date.parse(row.occurredAt) + clockOffsetMs;
    const tap = new Date(tapMs).toISOString();
    const saved = row.state !== "sent";
    if (row.kind === "clock_in" && !view.openRecord) {
      view = {
        ...view,
        openRecord: {
          id: row.id,
          rosterEntryId: null,
          workDate: kigaliDate(tapMs),
          clockInAt: tap,
          validated: false,
          pendingReason: null,
          saved,
        },
      };
    } else if (row.kind === "clock_out" && view.openRecord) {
      view = { ...view, openRecord: null, lastClockOutAt: tap, clockOutSaved: saved };
    }
  }
  return view;
}
