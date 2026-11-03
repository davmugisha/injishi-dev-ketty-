// Today in api mode: the real reads the shift card has run on since mobile spec 0003 (`GET /me/work` for
// the employee file, `GET /me/work/:employeeId/today` for the shift), kept on the phone under the same
// query keys as `src/data/queries/{me-work,today}.ts`, so the outbox refreshes them after a punch and the
// persisted copy is the one a cold start offline restores. Then the phone's own punches are laid over the
// read (`applyPendingToday`) and the result is drawn as Today's view model.

import { type MyWorkFile, MyWorkFileList, MyWorkToday } from "@injishi/contracts";
import { ApiError, getParsed } from "@/data/fetch";
import type { OutboxRow } from "@/data/outbox";
import type { OutboxSummary } from "@/data/outbox/rules";
import { applyPendingToday } from "@/data/outbox/overlay";
import { isCurrent } from "@/data/queries/today";
import { clockOffsetMs } from "@/lib/clock";
import { kigaliDate, kigaliDayLabel, kigaliHour, kigaliTime } from "@/lib/kigali";
import { queryClient } from "@/lib/query-client";
import { shiftCardState, startWords } from "./shift-state";
import type { ShiftCard, TodayView } from "./types";

/** What Today's read answers: the sample view in mock mode, the two real reads in api mode. */
export type TodayFeed =
  | { kind: "sample"; view: TodayView }
  | {
      kind: "api";
      file: MyWorkFile | null;
      today: MyWorkToday | null;
      /** When the copy on screen is a kept one because the API did not answer: its time, else null. */
      keptAt: number | null;
    };

/** One read under its real key, kept on the phone; with no answer, the kept copy if there is one. */
async function readKept<T>(key: readonly unknown[], read: () => Promise<T>): Promise<{ data: T; keptAt: number | null }> {
  try {
    // Always asks (staleTime 0): a pull to refresh means now. No retry here: the screen's own read retries.
    const data = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: read,
      staleTime: 0,
      retry: false,
      meta: { persist: true },
    });
    return { data, keptAt: null };
  } catch (error) {
    const kept = queryClient.getQueryState<T>(key);
    const noAnswer = error instanceof ApiError && error.kind === "failed" && !error.parse;
    if (noAnswer && kept?.data !== undefined) return { data: kept.data, keptAt: kept.dataUpdatedAt };
    throw error;
  }
}

/**
 * The employee file the shift card punches on (D-af: the active one in the housekeeping workspace's
 * org), then its today. No file is not an error: clock in is not set up here.
 */
export async function readToday(userId: string, orgId: string | null): Promise<TodayFeed> {
  const files = await readKept(["u", userId, "me-work"], () => getParsed(MyWorkFileList, "/api/v1/me/work"));
  const file = orgId ? (files.data.files.find((f) => f.orgId === orgId && f.status === "active") ?? null) : null;
  if (!file) return { kind: "api", file: null, today: null, keptAt: files.keptAt };
  const today = await readKept(["u", userId, "today", file.employeeId], () =>
    getParsed(MyWorkToday, `/api/v1/me/work/${file.employeeId}/today`),
  );
  return { kind: "api", file, today: today.data, keptAt: today.keptAt ?? files.keptAt };
}

/** "Good morning", by the phone's own clock (the value sourcing's rule). */
function greeting(now: number): string {
  const hour = kigaliHour(now);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Morning · 30 min break". */
function shiftWords(shift: { shiftName: string; breakMinutes: number }): string {
  return [shift.shiftName, shift.breakMinutes > 0 ? `${shift.breakMinutes} min break` : "no break"].join(" · ");
}

export interface ApiTodayContext {
  /** The signed in person's name and first name, from the session. */
  name: string;
  firstName: string;
  rows: readonly OutboxRow[];
  summary: OutboxSummary;
  now: number;
}

/** The real reads, with the phone's punches laid over them, as Today's view model. */
export function todayFromApi(feed: Extract<TodayFeed, { kind: "api" }>, ctx: ApiTodayContext): TodayView {
  const { file, today } = feed;
  const { now } = ctx;
  const place = [file?.jobPositionTitle, file?.branchName].filter(Boolean).join(" · ");
  const base: Omit<TodayView, "onShift" | "shift" | "clockInAt"> = {
    person: {
      name: ctx.name,
      fullName: ctx.name,
      role: place,
      employer: file?.businessName ?? null,
      place,
      portrait: null,
      tone: "accent",
    },
    sync: { label: ctx.summary.chip.label, tone: ctx.summary.chip.tone, waiting: ctx.summary.waiting },
    day: kigaliDayLabel(now),
    greeting: greeting(now),
    firstName: ctx.firstName,
    employeeId: file?.employeeId ?? null,
    // The briefing, the room list, Report a problem and the bell wait for their features (AC-18).
    briefing: null,
    rooms: null,
    canReport: false,
    hasInbox: false,
    asOf: feed.keptAt === null ? null : kigaliTime(feed.keptAt),
  };
  const before = (shift: ShiftCard, clockIn: boolean): TodayView => ({
    ...base,
    onShift: null,
    shift,
    clockInAt: clockIn ? kigaliTime(now) : null,
  });
  if (!file || !today) return before({ kind: "not-set-up" }, false);
  if (!isCurrent(today, kigaliDate(now))) return before({ kind: "stale" }, false);

  const state = shiftCardState(applyPendingToday(today, ctx.rows, clockOffsetMs()), now);
  switch (state.kind) {
    case "on_shift":
      return {
        ...base,
        onShift: {
          since: kigaliTime(state.since),
          detail: state.shift
            ? `Ends ${kigaliTime(state.shift.endsAt)} · ${shiftWords(state.shift)}`
            : "No shift on the roster today",
          saved: state.saved,
          confirmLater: state.confirmLater,
          breakSince: today.openBreak ? kigaliTime(today.openBreak.startedAt) : null,
          // Breaks arrive with milestone 3 (AC-22).
          canBreak: false,
        },
        shift: null,
        clockInAt: null,
      };
    case "clocked_out":
      return before({ kind: "clocked-out", at: kigaliTime(state.at), saved: state.saved }, true);
    case "before":
      return before(
        {
          kind: "before",
          span: `${kigaliTime(state.shift.startsAt)} – ${kigaliTime(state.shift.endsAt)}`,
          detail: shiftWords(state.shift),
          chip: startWords(state.minutes),
          // Location rides on every punch from milestone 4 (AC-25).
          location: null,
        },
        true,
      );
    case "no_shift":
      return before({ kind: "no-shift" }, true);
  }
}
