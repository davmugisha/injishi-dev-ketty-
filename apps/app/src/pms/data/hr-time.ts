"use client";

/**
 * The shift roster and attendance, on the wire (HR module, Phase 5 — first
 * pass, no ADR yet).
 *
 * Two audiences, as everywhere in HR:
 *
 *   HR's side      `/ops/hr/roster` and `/ops/hr/attendance`, behind
 *                  `employee.manage`. These reads wait on that permission, so a
 *                  caller without it never sends a request the API would refuse.
 *   the employee   `/ops/my-hr/time`, which gates no permission and takes no
 *                  employee id: the API answers for the session's user.
 *
 * In its own file rather than in `ops.ts`, which both HR branches already
 * edit: a new file cannot conflict when they meet.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { command } from "./api";
import { OPS_READ, read, useMayRead } from "./ops";

/** The API's answer is trusted as written, as the other HR reads are (no contract yet). */
const asIs = <T>(): { parse: (value: unknown) => T } => ({ parse: (value) => value as T });

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** A shift the business runs. Times are the Kigali wall clock, `07:00`. */
export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  /** Which step of the chart ramp it wears, 1 to 5. */
  colorSlot: number;
  isActive: boolean;
  minutes: number;
  /** Ends the morning after it starts. */
  overnight: boolean;
}

export interface RosterPerson {
  departmentMemberId: string;
  userId: string | null;
  name: string | null;
  jobTitle: string | null;
  departmentName: string | null;
}

export interface RosterWeek {
  from: string;
  to: string;
  today: string;
  /** Monday to Sunday. */
  days: string[];
  shifts: Shift[];
  people: RosterPerson[];
  assignments: { id: string; departmentMemberId: string; shiftId: string; workDate: string }[];
  /** Approved leave touching the week: nobody is rostered onto it. */
  leave: { departmentMemberId: string; startDate: string; endDate: string }[];
}

/**
 * Where somebody stands on one day. Worked out by the API from the roster,
 * leave and the clock, never stored: see `attendance.service.ts`.
 */
export type DayStatus = "working" | "done" | "missing" | "expected" | "on_leave" | "off";

export interface AttendanceEntry {
  id: string;
  departmentMemberId: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  shiftName: string | null;
  lateMinutes: number;
  /** To now while they are still at work. */
  workedMinutes: number;
  overtimeMinutes: number;
  leftEarlyMinutes: number;
  /** Open so long that the clock out was almost certainly forgotten. */
  stale: boolean;
  source: "self" | "manual";
  note: string | null;
}

export interface AttendanceBoardRow {
  departmentMemberId: string;
  name: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  shift: Shift | null;
  entry: AttendanceEntry | null;
  onLeave: boolean;
  status: DayStatus;
}

export interface AttendanceBoard {
  date: string;
  today: string;
  serverNow: string;
  summary: {
    people: number;
    rostered: number;
    working: number;
    done: number;
    late: number;
    missing: number;
    expected: number;
    onLeave: number;
  };
  rows: AttendanceBoardRow[];
}

export interface TimesheetRow {
  departmentMemberId: string;
  name: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  rosteredDays: number;
  presentDays: number;
  lateDays: number;
  missedDays: number;
  leaveDays: number;
  scheduledMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
}

export interface Timesheet {
  from: string;
  to: string;
  today: string;
  totals: {
    rosteredDays: number;
    presentDays: number;
    lateDays: number;
    missedDays: number;
    scheduledMinutes: number;
    workedMinutes: number;
    overtimeMinutes: number;
  };
  days: { date: string; rostered: number; present: number; late: number; missing: number; workedMinutes: number }[];
  rows: TimesheetRow[];
}

export interface MyTimeDay {
  date: string;
  shift: Shift | null;
  entry: AttendanceEntry | null;
  onLeave: boolean;
  status: DayStatus;
}

export interface MyTime {
  serverNow: string;
  today: string;
  /** Still clocked in, whichever day it began. */
  open: AttendanceEntry | null;
  todayShift: Shift | null;
  todayEntry: AttendanceEntry | null;
  canClockIn: boolean;
  canClockOut: boolean;
  week: MyTimeDay[];
  upcoming: { date: string; shift: Shift; onLeave: boolean }[];
  history: AttendanceEntry[];
  totals: { weekMinutes: number; monthMinutes: number; monthDays: number; monthLate: number };
}

// ---------------------------------------------------------------------------
// HR's side: the roster
// ---------------------------------------------------------------------------

/** Everything that changes when the roster does: the grid, today's board and the timesheet read it. */
function useRosterChanged(workspaceId: string | null): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["hr-roster", workspaceId] });
    void client.invalidateQueries({ queryKey: ["hr-attendance", workspaceId] });
    void client.invalidateQueries({ queryKey: ["my-hr", "time", workspaceId] });
  };
}

/** The week `from` sits in. `null` is this week. */
export function useRosterWeek(workspaceId: string | null, from: string | null): UseQueryResult<RosterWeek> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: ["hr-roster", workspaceId, "week", from],
    queryFn: () => read(`/ops/hr/roster${from ? `?from=${from}` : ""}`, workspaceId as string, asIs<RosterWeek>()),
    enabled: workspaceId !== null && mayRead,
    // The grid keeps the week it was showing while the next one loads, so
    // stepping through weeks does not flash a skeleton each time.
    placeholderData: (previous) => previous,
  });
}

export interface ShiftDraft {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  colorSlot?: number;
}

export function useCreateShift(workspaceId: string | null): UseMutationResult<Shift, Error, ShiftDraft> {
  const changed = useRosterChanged(workspaceId);
  return useMutation({
    mutationFn: (body) => command<Shift>("/ops/hr/roster/shifts", { workspaceId: workspaceId as string, body }),
    onSuccess: changed,
  });
}

export function useUpdateShift(
  workspaceId: string | null,
): UseMutationResult<Shift, Error, { shiftId: string; body: Partial<ShiftDraft> }> {
  const changed = useRosterChanged(workspaceId);
  return useMutation({
    mutationFn: ({ shiftId, body }) =>
      command<Shift>(`/ops/hr/roster/shifts/${shiftId}`, { workspaceId: workspaceId as string, body, method: "PATCH" }),
    onSuccess: changed,
  });
}

/** Stop offering a shift. Past weeks keep it. */
export function useRetireShift(workspaceId: string | null): UseMutationResult<void, Error, { shiftId: string }> {
  const changed = useRosterChanged(workspaceId);
  return useMutation({
    mutationFn: ({ shiftId }) =>
      command<void>(`/ops/hr/roster/shifts/${shiftId}`, { workspaceId: workspaceId as string, method: "DELETE" }),
    onSuccess: changed,
  });
}

/** One person, one day, one shift. A null shift clears the day. */
export function useAssignShift(
  workspaceId: string | null,
): UseMutationResult<void, Error, { departmentMemberId: string; workDate: string; shiftId: string | null }> {
  const changed = useRosterChanged(workspaceId);
  return useMutation({
    mutationFn: (body) =>
      command<void>("/ops/hr/roster/assignments", { workspaceId: workspaceId as string, body, method: "PUT" }),
    onSuccess: changed,
  });
}

/** Fill the empty days of one week from another. */
export function useCopyRosterWeek(
  workspaceId: string | null,
): UseMutationResult<{ copied: number; skipped: number }, Error, { from: string; to: string }> {
  const changed = useRosterChanged(workspaceId);
  return useMutation({
    mutationFn: (body) =>
      command<{ copied: number; skipped: number }>("/ops/hr/roster/copy-week", { workspaceId: workspaceId as string, body }),
    onSuccess: changed,
  });
}

// ---------------------------------------------------------------------------
// HR's side: attendance
// ---------------------------------------------------------------------------

/** Everybody on one day. `null` is today. While it is today, it is asked again every minute. */
export function useAttendanceBoard(workspaceId: string | null, date: string | null): UseQueryResult<AttendanceBoard> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: ["hr-attendance", workspaceId, "board", date],
    queryFn: () => read(`/ops/hr/attendance${date ? `?date=${date}` : ""}`, workspaceId as string, asIs<AttendanceBoard>()),
    enabled: workspaceId !== null && mayRead,
    placeholderData: (previous) => previous,
    // Somebody clocks in from their own phone: the board has to notice
    // without HR pressing anything. A past day never changes by itself.
    refetchInterval: (query) => {
      const data = query.state.data;
      return !data || data.date === data.today ? 60_000 : false;
    },
  });
}

export function useTimesheet(workspaceId: string | null, from: string, to: string): UseQueryResult<Timesheet> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: ["hr-attendance", workspaceId, "summary", from, to],
    queryFn: () => read(`/ops/hr/attendance/summary?from=${from}&to=${to}`, workspaceId as string, asIs<Timesheet>()),
    enabled: workspaceId !== null && mayRead,
    placeholderData: (previous) => previous,
  });
}

function useAttendanceChanged(workspaceId: string | null): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["hr-attendance", workspaceId] });
    void client.invalidateQueries({ queryKey: ["my-hr", "time", workspaceId] });
  };
}

/** HR writes a day for somebody, or corrects the one that is there. Times are `HH:MM`. */
export function useRecordAttendance(
  workspaceId: string | null,
): UseMutationResult<
  AttendanceEntry,
  Error,
  { departmentMemberId: string; workDate: string; clockIn: string; clockOut: string | null; note?: string }
> {
  const changed = useAttendanceChanged(workspaceId);
  return useMutation({
    mutationFn: (body) =>
      command<AttendanceEntry>("/ops/hr/attendance/entries", { workspaceId: workspaceId as string, body }),
    onSuccess: changed,
  });
}

export function useRemoveAttendance(workspaceId: string | null): UseMutationResult<void, Error, { entryId: string }> {
  const changed = useAttendanceChanged(workspaceId);
  return useMutation({
    mutationFn: ({ entryId }) =>
      command<void>(`/ops/hr/attendance/entries/${entryId}`, { workspaceId: workspaceId as string, method: "DELETE" }),
    onSuccess: changed,
  });
}

// ---------------------------------------------------------------------------
// The employee's own clock
// ---------------------------------------------------------------------------

/** No permission to wait on: the route answers for the session's user. */
export function useMyTime(workspaceId: string | null): UseQueryResult<MyTime> {
  return useQuery({
    queryKey: ["my-hr", "time", workspaceId],
    queryFn: () => read("/ops/my-hr/time", workspaceId as string, asIs<MyTime>()),
    enabled: workspaceId !== null,
    // HR may roster or correct a day while the page is open.
    refetchInterval: 60_000,
  });
}

/** Clock the caller in or out. Neither sends a body: who "I" am is the session. */
export function useClock(
  workspaceId: string | null,
): UseMutationResult<AttendanceEntry, Error, { direction: "in" | "out" }> {
  const changed = useAttendanceChanged(workspaceId);
  return useMutation({
    mutationFn: ({ direction }) =>
      command<AttendanceEntry>(`/ops/my-hr/time/clock-${direction}`, { workspaceId: workspaceId as string }),
    onSuccess: changed,
  });
}
