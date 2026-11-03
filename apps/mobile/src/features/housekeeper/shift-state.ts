// Which state the shift card is in (mobile spec 0003, the clock in child's card table), worked out from
// the read with the phone's punches laid over it. Pure, so `node --test` locks it.

import type { MyWorkTodayShift } from "@injishi/contracts";
import type { TodayView } from "../../data/outbox/overlay.ts";

export type ShiftCardState =
  | {
      kind: "on_shift";
      since: string;
      shift: MyWorkTodayShift | null;
      /** The clock in is still on this phone. */
      saved: boolean;
      /** A location reason: the manager confirms this clock in. */
      confirmLater: boolean;
    }
  | { kind: "clocked_out"; at: string; saved: boolean }
  /** `minutes` until the start; negative once it has started (never past its end). */
  | { kind: "before"; shift: MyWorkTodayShift; minutes: number }
  | { kind: "no_shift" };

const LOCATION_REASONS = new Set(["no_location", "no_branch_location", "poor_accuracy", "outside_fence"]);

/** The shift that is on now or next: the first not yet ended (the value sourcing's rule). */
export function currentShift(shifts: readonly MyWorkTodayShift[], nowMs: number): MyWorkTodayShift | null {
  return shifts.find((s) => Date.parse(s.endsAt) > nowMs) ?? null;
}

export function shiftCardState(view: TodayView, nowMs: number): ShiftCardState {
  const open = view.openRecord;
  if (open) {
    const own = open.rosterEntryId ? view.shifts.find((s) => s.rosterEntryId === open.rosterEntryId) : undefined;
    return {
      kind: "on_shift",
      since: open.clockInAt,
      shift: own ?? currentShift(view.shifts, nowMs),
      saved: open.saved,
      confirmLater: open.pendingReason !== null && LOCATION_REASONS.has(open.pendingReason),
    };
  }
  if (view.lastClockOutAt) return { kind: "clocked_out", at: view.lastClockOutAt, saved: view.clockOutSaved };
  const shift = currentShift(view.shifts, nowMs);
  if (!shift) return { kind: "no_shift" };
  return { kind: "before", shift, minutes: Math.round((Date.parse(shift.startsAt) - nowMs) / 60_000) };
}

/** "2 min", "1 h 20 min", "3 h". */
export function minutesWords(minutes: number): string {
  const m = Math.abs(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** The card's chip before a shift: "Starts in 2 min", or "Started 10 min ago" once it has. */
export function startWords(minutes: number): string {
  if (minutes > 0) return `Starts in ${minutesWords(minutes)}`;
  if (minutes === 0) return "Starts now";
  return `Started ${minutesWords(minutes)} ago`;
}
