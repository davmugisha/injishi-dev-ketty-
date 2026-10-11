import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import {
  AttendanceRepository,
  type AssignmentRow,
  type EntryRow,
  type ShiftRow,
} from '../infrastructure/attendance.repository';
import { EmployeeRepository } from '../infrastructure/employee.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { shiftDto, type ShiftDto } from './roster.service';
import {
  addDays,
  atKigali,
  daysBetween,
  isClock,
  isDay,
  isOvernight,
  kigaliClock,
  kigaliDay,
  lateMinutes,
  minutesBetween,
  mondayOf,
  shiftMinutes,
  shiftWindow,
} from './work-time';

/** Still clocked in this long after arriving is a forgotten clock out, not a long shift. */
const STALE_AFTER_MINUTES = 16 * 60;
/** The longest stretch one timesheet may cover. */
const MAX_SUMMARY_DAYS = 62;

/**
 * Where somebody stands on one day:
 *
 *   working   clocked in, not out
 *   done      clocked in and out
 *   missing   rostered, the shift has started (grace included), nothing recorded
 *   expected  rostered, the shift has not started yet
 *   on_leave  on approved leave, and nothing recorded
 *   off       not rostered, nothing recorded
 */
export type DayStatus = 'working' | 'done' | 'missing' | 'expected' | 'on_leave' | 'off';

/** A clock record as the wire carries it, with the sums a reader would otherwise redo. */
export interface EntryDto {
  id: string;
  departmentMemberId: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  shiftName: string | null;
  lateMinutes: number;
  /** To now while they are still at work. */
  workedMinutes: number;
  /** Minutes stayed past the scheduled end. */
  overtimeMinutes: number;
  /** Minutes left before the scheduled end. */
  leftEarlyMinutes: number;
  /** Open for so long that the clock out was almost certainly forgotten. */
  stale: boolean;
  source: 'self' | 'manual';
  note: string | null;
}

export interface BoardRow {
  departmentMemberId: string;
  name: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  shift: ShiftDto | null;
  entry: EntryDto | null;
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
  rows: BoardRow[];
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

export interface TimesheetDay {
  date: string;
  rostered: number;
  present: number;
  late: number;
  missing: number;
  workedMinutes: number;
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
  days: TimesheetDay[];
  rows: TimesheetRow[];
}

/**
 * What the roster, the clock and leave say about one person over a stretch of
 * days, as payroll needs it: the days that are paid for and the days that are
 * not.
 */
export interface MonthFacts {
  /** Shifts they were rostered on, up to today, leave left out. */
  rosteredDays: number;
  /** Days with a clock record. */
  workedDays: number;
  /** Rostered shifts that started and that nobody clocked. */
  missedDays: number;
  lateDays: number;
  /** Days of approved leave of a type the business set as unpaid. */
  unpaidLeaveDays: number;
  /** Minutes past the end of a rostered shift, on days that reached the threshold. */
  overtimeMinutes: number;
}

export interface MyTimeDay {
  date: string;
  shift: ShiftDto | null;
  entry: EntryDto | null;
  onLeave: boolean;
  status: DayStatus;
}

export interface MyTime {
  serverNow: string;
  today: string;
  /** Still clocked in, whichever day it began. */
  open: EntryDto | null;
  todayShift: ShiftDto | null;
  todayEntry: EntryDto | null;
  canClockIn: boolean;
  canClockOut: boolean;
  /** Monday to Sunday of this week. */
  week: MyTimeDay[];
  /** Shifts from tomorrow, two weeks out. */
  upcoming: { date: string; shift: ShiftDto; onLeave: boolean }[];
  /** The last five weeks of records, newest first. */
  history: EntryDto[];
  totals: { weekMinutes: number; monthMinutes: number; monthDays: number; monthLate: number };
}

function entryDto(entry: EntryRow, now: Date, shifts: ReadonlyMap<string, ShiftRow>): EntryDto {
  const worked = minutesBetween(entry.clockInAt, entry.clockOutAt ?? now);
  return {
    id: entry.id,
    departmentMemberId: entry.departmentMemberId,
    workDate: entry.workDate,
    clockInAt: entry.clockInAt.toISOString(),
    clockOutAt: entry.clockOutAt?.toISOString() ?? null,
    shiftName: entry.shiftId ? (shifts.get(entry.shiftId)?.name ?? null) : null,
    lateMinutes: entry.lateMinutes,
    workedMinutes: worked,
    overtimeMinutes:
      entry.clockOutAt && entry.scheduledEnd ? minutesBetween(entry.scheduledEnd, entry.clockOutAt) : 0,
    leftEarlyMinutes:
      entry.clockOutAt && entry.scheduledEnd ? minutesBetween(entry.clockOutAt, entry.scheduledEnd) : 0,
    stale: !entry.clockOutAt && worked > STALE_AFTER_MINUTES,
    source: entry.source,
    note: entry.note,
  };
}

function dayStatus(
  day: string,
  now: Date,
  shift: ShiftRow | undefined,
  entry: EntryRow | undefined,
  onLeave: boolean,
): DayStatus {
  if (entry) return entry.clockOutAt ? 'done' : 'working';
  if (onLeave) return 'on_leave';
  if (!shift) return 'off';
  const { start } = shiftWindow(day, shift.startTime, shift.endTime);
  return now.getTime() > start.getTime() + shift.graceMinutes * 60_000 ? 'missing' : 'expected';
}

/**
 * Attendance (HR module, Phase 5 — first pass, no ADR yet): who clocked in and
 * out, read against who was meant to.
 *
 * A STATUS IS WORKED OUT, NEVER STORED. "Missing" is a rostered shift whose
 * start has passed with nothing recorded, so it is true at 07:11 and stops
 * being true the moment the person clocks in or HR writes the day. A stored
 * "absent" flag would have to be kept in step with the roster, with leave and
 * with the clock, and would be wrong the first time one of them moved.
 *
 * WHAT IS STORED IS WHAT HAPPENED: the two instants, and the shift the arrival
 * was measured against (see `hr-attendance.ts`).
 *
 * THE EMPLOYEE'S SIDE TAKES NO EMPLOYEE ID. `mine`, `clockIn` and `clockOut`
 * are handed the member ids `MyHrService` resolved from the session, the same
 * rule as every other self-service route.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly time: AttendanceRepository,
    private readonly employees: EmployeeRepository,
    private readonly leave: LeaveRepository,
  ) {}

  // --- HR's side -----------------------------------------------------------

  /** Everybody on one day: their shift, their record, and where that leaves them. */
  async board(ws: WorkspaceAccess, day?: string): Promise<AttendanceBoard> {
    if (day !== undefined && !isDay(day)) throw new BadRequestException('Choose a day.');
    const now = new Date();
    const today = kigaliDay(now);
    const date = day ?? today;

    const [people, shiftRows, assignments, entries, leave] = await Promise.all([
      this.employees.listForWorkspace(ws.workspaceId),
      this.time.listShifts(ws.workspaceId),
      this.time.listAssignments(ws.workspaceId, date, date),
      this.time.listEntries(ws.workspaceId, date, date),
      this.time.approvedLeave(ws.workspaceId, date, date),
    ]);
    const shifts = new Map(shiftRows.map((s) => [s.id, s]));
    const assignmentOf = new Map(assignments.map((a) => [a.departmentMemberId, a]));
    const entryOf = new Map(entries.map((e) => [e.departmentMemberId, e]));
    const away = new Set(leave.map((l) => l.departmentMemberId));

    const rows: BoardRow[] = people
      .map((p) => {
        const assignment = assignmentOf.get(p.departmentMemberId);
        const shift = assignment ? shifts.get(assignment.shiftId) : undefined;
        const entry = entryOf.get(p.departmentMemberId);
        return {
          departmentMemberId: p.departmentMemberId,
          name: p.name,
          jobTitle: p.jobTitle,
          departmentName: p.departmentName,
          shift: shift ? shiftDto(shift) : null,
          entry: entry ? entryDto(entry, now, shifts) : null,
          onLeave: away.has(p.departmentMemberId),
          status: dayStatus(date, now, shift, entry, away.has(p.departmentMemberId)),
        };
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    const count = (status: DayStatus): number => rows.filter((r) => r.status === status).length;
    return {
      date,
      today,
      serverNow: now.toISOString(),
      summary: {
        people: rows.length,
        rostered: rows.filter((r) => r.shift).length,
        working: count('working'),
        done: count('done'),
        late: rows.filter((r) => (r.entry?.lateMinutes ?? 0) > 0).length,
        missing: count('missing'),
        expected: count('expected'),
        onLeave: count('on_leave'),
      },
      rows,
    };
  }

  /**
   * A stretch of days added up per person: the timesheet. Defaults to this
   * week so far. A future day counts for nothing, since nobody has worked it.
   */
  async summary(ws: WorkspaceAccess, fromDay?: string, toDay?: string): Promise<Timesheet> {
    const now = new Date();
    const today = kigaliDay(now);
    const from = fromDay ?? mondayOf(today);
    const to = toDay ?? today;
    if (!isDay(from) || !isDay(to) || to < from) throw new BadRequestException('Choose the first and last day.');
    if (daysBetween(from, to) >= MAX_SUMMARY_DAYS) {
      throw new BadRequestException(`A timesheet covers at most ${MAX_SUMMARY_DAYS} days.`);
    }

    const [people, shiftRows, assignments, entries, leave] = await Promise.all([
      this.employees.listForWorkspace(ws.workspaceId),
      this.time.listShifts(ws.workspaceId),
      this.time.listAssignments(ws.workspaceId, from, to),
      this.time.listEntries(ws.workspaceId, from, to),
      this.time.approvedLeave(ws.workspaceId, from, to),
    ]);
    const shifts = new Map(shiftRows.map((s) => [s.id, s]));
    const key = (memberId: string, day: string): string => `${memberId}|${day}`;
    const assignmentOn = new Map(assignments.map((a) => [key(a.departmentMemberId, a.workDate), a]));
    const entryOn = new Map(entries.map((e) => [key(e.departmentMemberId, e.workDate), e]));
    const onLeave = (memberId: string, day: string): boolean =>
      leave.some((l) => l.departmentMemberId === memberId && l.startDate <= day && day <= l.endDate);

    const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
    const perDay = new Map<string, TimesheetDay>(
      days.map((d) => [d, { date: d, rostered: 0, present: 0, late: 0, missing: 0, workedMinutes: 0 }]),
    );

    const rows = people.map((p) => {
      const row: TimesheetRow = {
        departmentMemberId: p.departmentMemberId,
        name: p.name,
        jobTitle: p.jobTitle,
        departmentName: p.departmentName,
        rosteredDays: 0,
        presentDays: 0,
        lateDays: 0,
        missedDays: 0,
        leaveDays: 0,
        scheduledMinutes: 0,
        workedMinutes: 0,
        overtimeMinutes: 0,
        lateMinutes: 0,
      };
      for (const day of days) {
        if (day > today) continue;
        const tally = perDay.get(day)!;
        const assignment = assignmentOn.get(key(p.departmentMemberId, day));
        const shift = assignment ? shifts.get(assignment.shiftId) : undefined;
        const entry = entryOn.get(key(p.departmentMemberId, day));
        const away = onLeave(p.departmentMemberId, day);

        if (away) row.leaveDays += 1;
        if (shift && !away) {
          row.rosteredDays += 1;
          row.scheduledMinutes += shiftMinutes(shift.startTime, shift.endTime);
          tally.rostered += 1;
        }
        if (entry) {
          const dto = entryDto(entry, now, shifts);
          row.presentDays += 1;
          row.workedMinutes += dto.workedMinutes;
          row.overtimeMinutes += dto.overtimeMinutes;
          tally.present += 1;
          tally.workedMinutes += dto.workedMinutes;
          if (entry.lateMinutes > 0) {
            row.lateDays += 1;
            row.lateMinutes += entry.lateMinutes;
            tally.late += 1;
          }
        }
        if (dayStatus(day, now, shift, entry, away) === 'missing') {
          row.missedDays += 1;
          tally.missing += 1;
        }
      }
      return row;
    });

    const sum = (pick: (r: TimesheetRow) => number): number => rows.reduce((n, r) => n + pick(r), 0);
    return {
      from,
      to,
      today,
      totals: {
        rosteredDays: sum((r) => r.rosteredDays),
        presentDays: sum((r) => r.presentDays),
        lateDays: sum((r) => r.lateDays),
        missedDays: sum((r) => r.missedDays),
        scheduledMinutes: sum((r) => r.scheduledMinutes),
        workedMinutes: sum((r) => r.workedMinutes),
        overtimeMinutes: sum((r) => r.overtimeMinutes),
      },
      days: [...perDay.values()],
      rows: rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    };
  }

  /**
   * A month, as payroll reads it: one entry per employee record.
   *
   * A day in the FUTURE counts for nothing. A run made on the 20th cannot know
   * whether the 25th will be worked, so it takes nothing off for it; running
   * the month again, or recalculating the draft, picks up the days since.
   *
   * Overtime counts only on a day it reaches `overtimeFromMinutes`, and only
   * on a record that was clocked out: somebody still "at work" since yesterday
   * has forgotten the button, not worked nineteen hours.
   */
  async payFacts(
    workspaceId: string,
    from: string,
    to: string,
    overtimeFromMinutes: number,
  ): Promise<Map<string, MonthFacts>> {
    const now = new Date();
    const today = kigaliDay(now);
    const facts = new Map<string, MonthFacts>();
    if (!isDay(from) || !isDay(to) || to < from) return facts;

    const [people, shiftRows, assignments, entries, leave, typeSettings] = await Promise.all([
      this.employees.listForWorkspace(workspaceId),
      this.time.listShifts(workspaceId),
      this.time.listAssignments(workspaceId, from, to),
      this.time.listEntries(workspaceId, from, to),
      this.time.approvedLeave(workspaceId, from, to),
      this.leave.listTypeSettings(workspaceId),
    ]);
    const shifts = new Map(shiftRows.map((s) => [s.id, s]));
    const key = (memberId: string, day: string): string => `${memberId}|${day}`;
    const assignmentOn = new Map(assignments.map((a) => [key(a.departmentMemberId, a.workDate), a]));
    const entryOn = new Map(entries.map((e) => [key(e.departmentMemberId, e.workDate), e]));
    // Unpaid leave is unpaid by name; any other type is unpaid when the business set it so.
    const unpaidTypes = new Set<string>(['unpaid', ...typeSettings.filter((s) => s.isUnpaid).map((s) => s.leaveType)]);
    for (const s of typeSettings) if (s.leaveType === 'unpaid' && !s.isUnpaid) unpaidTypes.delete('unpaid');
    const leaveOn = (memberId: string, day: string): { unpaid: boolean } | null => {
      const span = leave.find((l) => l.departmentMemberId === memberId && l.startDate <= day && day <= l.endDate);
      return span ? { unpaid: unpaidTypes.has(span.leaveType) } : null;
    };

    const lastDay = to < today ? to : today;
    for (const p of people) {
      const row: MonthFacts = { rosteredDays: 0, workedDays: 0, missedDays: 0, lateDays: 0, unpaidLeaveDays: 0, overtimeMinutes: 0 };
      for (let day = from; day <= lastDay; day = addDays(day, 1)) {
        const assignment = assignmentOn.get(key(p.departmentMemberId, day));
        const shift = assignment ? shifts.get(assignment.shiftId) : undefined;
        const entry = entryOn.get(key(p.departmentMemberId, day));
        const away = leaveOn(p.departmentMemberId, day);

        if (away?.unpaid && !entry) row.unpaidLeaveDays += 1;
        if (shift && !away) row.rosteredDays += 1;
        if (entry) {
          row.workedDays += 1;
          if (entry.lateMinutes > 0) row.lateDays += 1;
          const over = entryDto(entry, now, shifts).overtimeMinutes;
          if (over >= overtimeFromMinutes) row.overtimeMinutes += over;
        }
        if (dayStatus(day, now, shift, entry, away !== null) === 'missing') row.missedDays += 1;
      }
      facts.set(p.departmentMemberId, row);
    }
    return facts;
  }

  /** What a shift on a day asks of whoever is on it, if anybody is. */
  private async scheduled(
    workspaceId: string,
    departmentMemberId: string,
    workDate: string,
  ): Promise<{ shift: ShiftRow | undefined; start: Date | null; end: Date | null }> {
    const [assignment] = await this.time.assignmentsForMembers([departmentMemberId], workDate, workDate);
    const shift = assignment ? await this.time.findShift(workspaceId, assignment.shiftId) : undefined;
    if (!shift) return { shift: undefined, start: null, end: null };
    const { start, end } = shiftWindow(workDate, shift.startTime, shift.endTime);
    return { shift, start, end };
  }

  /**
   * HR writes a day, or corrects the one that is there: a forgotten clock out,
   * a phone left at home. A clock out at or before the clock in is the next
   * morning, which is how a night shift is typed.
   */
  async record(
    ws: WorkspaceAccess,
    userId: string,
    body: { departmentMemberId?: string; workDate?: string; clockIn?: string; clockOut?: string | null; note?: string },
  ): Promise<EntryDto> {
    if (!body.departmentMemberId || !isDay(body.workDate)) throw new BadRequestException('Choose a person and a day.');
    if (!isClock(body.clockIn)) throw new BadRequestException('Say when they clocked in, like 07:05.');
    if (body.clockOut && !isClock(body.clockOut)) throw new BadRequestException('Say when they clocked out, like 15:00.');
    if (!(await this.time.activeMember(ws.workspaceId, body.departmentMemberId))) {
      throw new NotFoundException('That employee is not on your roster.');
    }

    const now = new Date();
    const clockInAt = atKigali(body.workDate, body.clockIn);
    const clockOutAt = body.clockOut
      ? atKigali(body.clockOut <= body.clockIn ? addDays(body.workDate, 1) : body.workDate, body.clockOut)
      : null;
    if (clockInAt > now) throw new BadRequestException('That clock in time has not happened yet.');
    if (clockOutAt && clockOutAt > now) throw new BadRequestException('That clock out time has not happened yet.');

    const { shift, start, end } = await this.scheduled(ws.workspaceId, body.departmentMemberId, body.workDate);
    const row = await this.time.writeEntry({
      workspaceId: ws.workspaceId,
      departmentMemberId: body.departmentMemberId,
      workDate: body.workDate,
      clockInAt,
      clockOutAt,
      shiftId: shift?.id ?? null,
      scheduledStart: start,
      scheduledEnd: end,
      lateMinutes: lateMinutes(clockInAt, start, shift?.graceMinutes ?? 0),
      note: body.note?.trim().slice(0, 300) || null,
      recordedByUserId: userId,
    });
    return entryDto(row, now, new Map(shift ? [[shift.id, shift]] : []));
  }

  async remove(ws: WorkspaceAccess, entryId: string): Promise<void> {
    if (!(await this.time.deleteEntry(ws.workspaceId, entryId))) {
      throw new NotFoundException('That record is not one of yours.');
    }
  }

  // --- The employee's own side -------------------------------------------

  /** One person's own clock, week, coming shifts and recent days. */
  async mine(ws: WorkspaceAccess, memberIds: readonly string[]): Promise<MyTime> {
    const now = new Date();
    const today = kigaliDay(now);
    const weekStart = mondayOf(today);
    const monthStart = `${today.slice(0, 7)}-01`;
    const historyStart = addDays(today, -34);
    const earliest = [weekStart, monthStart, historyStart].sort()[0];

    const [shiftRows, assignments, entries, leave, open] = await Promise.all([
      this.time.listShifts(ws.workspaceId),
      this.time.assignmentsForMembers(memberIds, weekStart, addDays(today, 14)),
      this.time.entriesForMembers(memberIds, earliest, today),
      this.time.approvedLeave(ws.workspaceId, weekStart, addDays(today, 14)),
      this.time.openEntry(memberIds),
    ]);
    const shifts = new Map(shiftRows.map((s) => [s.id, s]));
    const mine = new Set(memberIds);
    const myLeave = leave.filter((l) => mine.has(l.departmentMemberId));
    const onLeave = (day: string): boolean => myLeave.some((l) => l.startDate <= day && day <= l.endDate);
    const shiftOn = (day: string): ShiftRow | undefined => {
      const assignment = assignments.find((a) => a.workDate === day);
      return assignment ? shifts.get(assignment.shiftId) : undefined;
    };
    const entryOn = (day: string): EntryRow | undefined => entries.find((e) => e.workDate === day);
    const dto = (entry: EntryRow | undefined): EntryDto | null => (entry ? entryDto(entry, now, shifts) : null);
    const shiftOrNull = (shift: ShiftRow | undefined): ShiftDto | null => (shift ? shiftDto(shift) : null);
    const worked = (from: string): number =>
      entries.filter((e) => e.workDate >= from).reduce((n, e) => n + entryDto(e, now, shifts).workedMinutes, 0);

    const todayEntry = entryOn(today);
    const thisMonth = entries.filter((e) => e.workDate >= monthStart);

    return {
      serverNow: now.toISOString(),
      today,
      open: dto(open),
      todayShift: shiftOrNull(shiftOn(today)),
      todayEntry: dto(todayEntry),
      canClockIn: memberIds.length > 0 && !open && !todayEntry,
      canClockOut: Boolean(open),
      week: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const shift = shiftOn(day);
        const entry = entryOn(day);
        return {
          date: day,
          shift: shiftOrNull(shift),
          entry: dto(entry),
          onLeave: onLeave(day),
          status: dayStatus(day, now, shift, entry, onLeave(day)),
        };
      }),
      upcoming: assignments
        .filter((a) => a.workDate > today && shifts.has(a.shiftId))
        .map((a) => ({ date: a.workDate, shift: shiftDto(shifts.get(a.shiftId)!), onLeave: onLeave(a.workDate) })),
      history: entries.filter((e) => e.workDate >= historyStart).map((e) => entryDto(e, now, shifts)),
      totals: {
        weekMinutes: worked(weekStart),
        monthMinutes: worked(monthStart),
        monthDays: thisMonth.length,
        monthLate: thisMonth.filter((e) => e.lateMinutes > 0).length,
      },
    };
  }

  /**
   * Which record a clock in belongs to. A night shift that began yesterday and
   * is still running takes it, so somebody arriving at 00:20 for a 23:00 shift
   * is eighty minutes late for last night, not unrostered this morning.
   */
  private async target(
    workspaceId: string,
    memberIds: readonly string[],
    now: Date,
  ): Promise<{ departmentMemberId: string; workDate: string; shift: ShiftRow | undefined }> {
    const today = kigaliDay(now);
    const yesterday = addDays(today, -1);
    const assignments = await this.time.assignmentsForMembers(memberIds, yesterday, today);
    const shiftOf = async (assignment: AssignmentRow | undefined): Promise<ShiftRow | undefined> =>
      assignment ? this.time.findShift(workspaceId, assignment.shiftId) : undefined;

    for (const assignment of assignments.filter((a) => a.workDate === yesterday)) {
      const shift = await shiftOf(assignment);
      if (!shift || !isOvernight(shift.startTime, shift.endTime)) continue;
      const stillRunning = now < shiftWindow(yesterday, shift.startTime, shift.endTime).end;
      if (stillRunning && !(await this.time.findEntry(assignment.departmentMemberId, yesterday))) {
        return { departmentMemberId: assignment.departmentMemberId, workDate: yesterday, shift };
      }
    }
    const rostered = assignments.find((a) => a.workDate === today);
    const shift = await shiftOf(rostered);
    if (rostered && shift) return { departmentMemberId: rostered.departmentMemberId, workDate: today, shift };
    // Not rostered: the day is still theirs to record, against no shift.
    return { departmentMemberId: memberIds[0], workDate: today, shift: undefined };
  }

  async clockIn(ws: WorkspaceAccess, userId: string, memberIds: readonly string[]): Promise<EntryDto> {
    if (memberIds.length === 0) {
      throw new BadRequestException('You have no employee record here yet. Ask HR to add you as an employee first.');
    }
    const now = new Date();
    const open = await this.time.openEntry(memberIds);
    if (open) throw new ConflictException(`You are already clocked in, since ${kigaliClock(open.clockInAt)}.`);

    const { departmentMemberId, workDate, shift } = await this.target(ws.workspaceId, memberIds, now);
    if (await this.time.findEntry(departmentMemberId, workDate)) {
      throw new ConflictException('You have already clocked in and out today. Ask HR if the record needs correcting.');
    }
    const window = shift ? shiftWindow(workDate, shift.startTime, shift.endTime) : null;
    const row = await this.time.clockIn({
      workspaceId: ws.workspaceId,
      departmentMemberId,
      workDate,
      clockInAt: now,
      shiftId: shift?.id ?? null,
      scheduledStart: window?.start ?? null,
      scheduledEnd: window?.end ?? null,
      lateMinutes: lateMinutes(now, window?.start ?? null, shift?.graceMinutes ?? 0),
      recordedByUserId: userId,
    });
    // A second press that raced the first: the day already has its record.
    if (!row) throw new ConflictException('You are already clocked in.');
    return entryDto(row, now, new Map(shift ? [[shift.id, shift]] : []));
  }

  async clockOut(ws: WorkspaceAccess, memberIds: readonly string[]): Promise<EntryDto> {
    const now = new Date();
    const open = await this.time.openEntry(memberIds);
    if (!open) throw new ConflictException('You are not clocked in.');
    const row = await this.time.clockOut(open.id, now);
    if (!row) throw new ConflictException('You are not clocked in.');
    const shift = row.shiftId ? await this.time.findShift(ws.workspaceId, row.shiftId) : undefined;
    return entryDto(row, now, new Map(shift ? [[shift.id, shift]] : []));
  }
}
