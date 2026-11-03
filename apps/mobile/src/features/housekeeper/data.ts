// The staff phone screens' reads and writes, on the proto-ui seam (`@/data/source`). Mock mode answers
// from `mock-data.ts`. Api mode keeps the real calls that exist today: Today's shift from `GET /me/work`
// and `GET /me/work/:employeeId/today` (see `api-today.ts`), the clock in and clock out through the
// outbox, and the Me screen's session rows (who is signed in, what waits on this phone, sign out). Every
// other read and write has no real call yet, so api mode shows "Not connected yet" there. That includes
// Mark clean: the outbox names `task_done` in its rules but registers no such kind in `kinds.ts` yet,
// and there is no room list read for a task to come from.

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/data/fetch";
import { enqueue, useOutboxRows } from "@/data/outbox";
import { type OutboxSummary, summarize } from "@/data/outbox/rules";
import { useAction, useSource } from "@/data/source";
import { isMock } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { serverNow } from "@/lib/clock";
import { readToday, type TodayFeed, todayFromApi } from "./api-today";
import {
  mockAskFix,
  mockAskLeave,
  mockAskSwap,
  mockCheckPin,
  mockClockIn,
  mockClockOut,
  mockFinishRoom,
  mockFound,
  mockHours,
  mockLeave,
  mockLogFound,
  mockMe,
  mockNewClaim,
  mockPin,
  mockReport,
  mockReportSaved,
  mockRooms,
  mockRoomsEmpty,
  mockSavePayslip,
  mockSaveReport,
  mockSchedule,
  mockScheduleSeen,
  mockSetCheck,
  mockSetMinibar,
  mockStartRoom,
  mockTabBadges,
  mockTask,
  mockTaskDone,
  mockToday,
  mockToggleBreak,
  mockToggleTimer,
} from "./mock-data";
import type {
  LeaveInput,
  MeView,
  ReportInput,
  StaffApp,
  StaffPerson,
  TodayView,
} from "./types";

/** Every sample write reads the folder again, so each screen shows the change. */
const AGAIN = [["housekeeper"]] as const;

// ---------- Today (hk-clockin, hk-today)

/**
 * The clock, on the server's time as the phone knows it, ticking every 20 seconds (api mode only: the
 * offset is kept in the outbox's SQLite store, which the sample data never opens).
 */
function useServerClock(): number {
  const [now, setNow] = useState(() => (isMock ? Date.now() : serverNow()));
  useEffect(() => {
    if (isMock) return;
    const timer = setInterval(() => setNow(serverNow()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Today: before the shift (the clock in) or on it. In mock mode `phase=before-shift` shows the clock in;
 * in api mode the real shift decides, with the phone's own punches laid over the read.
 */
export function useToday(phase: string | undefined) {
  const { account, persona } = useSession();
  const userId = account?.userId ?? null;
  const orgId = account?.workspace?.orgId ?? null;
  const rows = useOutboxRows(userId);
  const now = useServerClock();
  const query = useSource<TodayFeed>(["housekeeper", "today", phase ?? "on-shift", userId], {
    mock: () => ({ kind: "sample", view: mockToday(phase) }),
    api: () => (userId ? readToday(userId, orgId) : Promise.reject(new ApiError("signedOut"))),
  });
  const feed = query.data;
  const name = persona?.name ?? account?.name ?? "";
  const firstName = persona?.firstName ?? name.split(" ")[0] ?? "";
  const data = useMemo<TodayView | undefined>(() => {
    if (!feed) return undefined;
    if (feed.kind === "sample") return feed.view;
    return todayFromApi(feed, { name, firstName, rows, summary: summarize(rows), now });
  }, [feed, name, firstName, rows, now]);
  return { query, data };
}

/** A punch saved on the phone and sent by the outbox (mobile spec 0003): it shows at once, by the overlay. */
function punch(userId: string | undefined, employeeId: string | null, kind: "clock_in" | "clock_out"): Promise<void> {
  if (!userId || !employeeId) return Promise.reject(new Error("Clock in isn't set up here."));
  // Location rides on every punch from milestone 4 (AC-25); the payload is the punch alone until then.
  const saved = enqueue(userId, { kind, subjectId: employeeId, payload: {} });
  return saved.ok ? Promise.resolve() : Promise.reject(new Error(saved.reason));
}

/** Clock in, at the time on the button. */
export function useClockIn() {
  const { account } = useSession();
  return useAction<{ employeeId: string | null; at: string | null }, void>({
    mock: ({ at }) => mockClockIn(at),
    api: ({ employeeId }) => punch(account?.userId, employeeId, "clock_in"),
    // Api mode shows the punch through the outbox overlay; reading again would only spend signal.
    invalidates: isMock ? AGAIN : [],
  });
}

export function useClockOut() {
  const { account } = useSession();
  return useAction<{ employeeId: string | null }, void>({
    mock: () => mockClockOut(),
    api: ({ employeeId }) => punch(account?.userId, employeeId, "clock_out"),
    invalidates: isMock ? AGAIN : [],
  });
}

/** Start or end a break. Breaks arrive in api mode with milestone 3. */
export function useToggleBreak() {
  return useAction<void, void>({ mock: () => mockToggleBreak(), invalidates: AGAIN });
}

// ---------- My rooms, a room's task, done, found

export function useRooms() {
  return useSource(["housekeeper", "rooms"], { mock: mockRooms, empty: mockRoomsEmpty });
}

/** One room's task; null when the room is not on her list. */
export function useTask(room: string) {
  return useSource(["housekeeper", "task", room], { mock: () => mockTask(room) });
}

/** Opening a room starts its clock. */
export function useStartRoom() {
  return useAction<string, void>({ mock: (room) => mockStartRoom(room), invalidates: AGAIN });
}

export function useToggleTimer() {
  return useAction<string, void>({ mock: (room) => mockToggleTimer(room), invalidates: AGAIN });
}

export function useSetCheck() {
  return useAction<{ room: string; id: string; done: boolean }, void>({
    mock: ({ room, id, done }) => mockSetCheck(room, id, done),
    invalidates: AGAIN,
  });
}

export function useSetMinibar() {
  return useAction<{ room: string; key: string; count: number }, void>({
    mock: ({ room, key, count }) => mockSetMinibar(room, key, count),
    invalidates: AGAIN,
  });
}

/** Mark clean: Clean, not Ready, until the supervisor inspects. */
export function useFinishRoom() {
  return useAction<string, void>({ mock: (room) => mockFinishRoom(room), invalidates: AGAIN });
}

export function useTaskDone(room: string) {
  return useSource(["housekeeper", "task-done", room], { mock: () => mockTaskDone(room) });
}

export function useFound(room: string) {
  return useSource(["housekeeper", "found", room], { mock: () => mockFound(room) });
}

export function useLogFound() {
  return useAction<{ room: string; what: string; place: string }, void>({
    mock: (item) => mockLogFound(item),
    invalidates: AGAIN,
  });
}

// ---------- Report a problem

export function useReport() {
  return useSource(["housekeeper", "report"], { mock: mockReport });
}

export function useSaveReport() {
  return useAction<ReportInput, void>({ mock: (input) => mockSaveReport(input), invalidates: AGAIN });
}

export function useReportSaved() {
  return useSource(["housekeeper", "report-saved"], { mock: mockReportSaved });
}

// ---------- Schedule and leave

/** One week of the schedule: 0 this week, 1 next week, -1 last week. */
export function useSchedule(app: StaffApp, offset: number) {
  return useSource(["housekeeper", "schedule", app, offset], { mock: () => mockSchedule(app, offset) });
}

/** Offer a shift for a swap. */
export function useAskSwap() {
  return useAction<string, void>({ mock: (key) => mockAskSwap(key), invalidates: AGAIN });
}

/** She has looked at her schedule: the tab's dot goes. */
export function useMarkScheduleSeen() {
  return useAction<void, void>({ mock: () => mockScheduleSeen(), invalidates: AGAIN });
}

/** The housekeeper tab bar's badges. */
export function useTabBadgeSource() {
  return useSource(["housekeeper", "tab-badges"], { mock: mockTabBadges });
}

export function useLeave(app: StaffApp) {
  return useSource(["housekeeper", "leave", app], { mock: () => mockLeave(app) });
}

export function useAskLeave(app: StaffApp) {
  return useAction<LeaveInput, void>({ mock: (input) => mockAskLeave(app, input), invalidates: AGAIN });
}

// ---------- Me, PIN, hours

/** Me in api mode: the signed in person and this phone. Payslips, hours and leave have no read yet. */
function meFromSession(person: StaffPerson): MeView {
  return {
    person,
    work: [],
    files: [],
    phone: [
      { key: "outbox", icon: "CloudCheck", tone: "default", title: "On this phone", subtitle: "" },
      { key: "language", icon: "Globe", tone: "default", title: "Language", subtitle: "English" },
      { key: "signout", icon: "ArrowRightFromSquare", tone: "default", title: "Sign out", subtitle: "" },
    ],
  };
}

/** What waits on this phone, laid over the outbox row as it changes (api mode). */
function withOutbox(me: MeView, summary: OutboxSummary): MeView {
  const subtitle = summary.waiting > 0 ? `${summary.waiting} waiting to send` : "Everything is sent";
  return { ...me, phone: me.phone.map((row) => (row.key === "outbox" ? { ...row, subtitle } : row)) };
}

/** Me: the person and their rows. Answers `{ query, data }`: in api mode `data` follows the outbox live. */
export function useMe(app: StaffApp) {
  const { account, persona } = useSession();
  const rows = useOutboxRows(account?.userId);
  const name = persona?.name ?? account?.name ?? "";
  const email = account?.email ?? "";
  const query = useSource(["housekeeper", "me", app], {
    mock: () => mockMe(app),
    api: () =>
      Promise.resolve(
        meFromSession({ name, fullName: name, role: email, employer: null, place: "", portrait: null, tone: "accent" }),
      ),
  });
  const me = query.data;
  const data = useMemo(() => (me && !isMock ? withOutbox(me, summarize(rows)) : me), [me, rows]);
  return { query, data };
}

export function usePin() {
  return useSource(["housekeeper", "pin"], { mock: mockPin });
}

/** Checks the payslip PIN; `null` is the fingerprint. Answers whether it opens. */
export function useCheckPin() {
  return useAction<string | null, boolean>({ mock: (pin) => mockCheckPin(pin) });
}

export function useHours(app: StaffApp) {
  return useSource(["housekeeper", "hours", app], { mock: () => mockHours(app) });
}

export function useAskFix(app: StaffApp) {
  return useAction<void, void>({ mock: () => mockAskFix(app), invalidates: AGAIN });
}

export function useSavePayslip(app: StaffApp) {
  return useAction<void, void>({ mock: () => mockSavePayslip(app), invalidates: AGAIN });
}

export function useNewClaim(app: StaffApp) {
  return useAction<void, void>({ mock: () => mockNewClaim(app), invalidates: AGAIN });
}
