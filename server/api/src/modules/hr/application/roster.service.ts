import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import {
  AttendanceRepository,
  type AssignmentRow,
  type ShiftRow,
  type ShiftValues,
} from '../infrastructure/attendance.repository';
import { EmployeeRepository } from '../infrastructure/employee.repository';
import { addDays, isClock, isDay, isOvernight, kigaliDay, mondayOf, shiftMinutes, toClock } from './work-time';

export interface ShiftBody {
  name?: string;
  startTime?: string;
  endTime?: string;
  graceMinutes?: number;
  colorSlot?: number;
}

/** A shift as the wire carries it: times to the minute, and how long it runs. */
export interface ShiftDto {
  id: string;
  name: string;
  /** Wall clock in Kigali, `07:00`. */
  startTime: string;
  endTime: string;
  graceMinutes: number;
  colorSlot: number;
  isActive: boolean;
  minutes: number;
  /** Ends the morning after it starts. */
  overnight: boolean;
}

/** Somebody the roster has a row for. */
export interface RosterPerson {
  departmentMemberId: string;
  userId: string | null;
  name: string | null;
  jobTitle: string | null;
  departmentName: string | null;
}

/** A stretch of approved leave, as the roster and the board read it. */
export interface LeaveSpan {
  departmentMemberId: string;
  startDate: string;
  endDate: string;
}

export interface RosterWeek {
  from: string;
  to: string;
  today: string;
  days: string[];
  shifts: ShiftDto[];
  people: RosterPerson[];
  assignments: AssignmentRow[];
  leave: LeaveSpan[];
}

export function shiftDto(row: ShiftRow): ShiftDto {
  return {
    id: row.id,
    name: row.name,
    startTime: toClock(row.startTime),
    endTime: toClock(row.endTime),
    graceMinutes: row.graceMinutes,
    colorSlot: row.colorSlot,
    isActive: row.isActive,
    minutes: shiftMinutes(row.startTime, row.endTime),
    overnight: isOvernight(row.startTime, row.endTime),
  };
}

/**
 * The shift roster (HR module, Phase 5 — first pass, no ADR yet): the shifts a
 * business runs, and who is on which one, a week at a time.
 *
 * A WEEK IS MONDAY TO SUNDAY. Whatever day a reader asks for, they are given
 * the week it sits in, so two people looking at "this week" are looking at the
 * same seven days.
 *
 * NOBODY IS ROSTERED ONTO THEIR OWN LEAVE. A day inside approved leave refuses
 * a shift, in words, rather than leaving HR to notice the clash when the
 * person does not arrive.
 */
@Injectable()
export class RosterService {
  constructor(
    private readonly time: AttendanceRepository,
    private readonly employees: EmployeeRepository,
  ) {}

  async shifts(ws: WorkspaceAccess): Promise<ShiftDto[]> {
    return (await this.time.listShifts(ws.workspaceId)).map(shiftDto);
  }

  private read(body: ShiftBody, partial: boolean): Partial<ShiftValues> {
    const values: Partial<ShiftValues> = {};
    if (body.name !== undefined || !partial) {
      const name = (body.name ?? '').trim();
      if (name.length < 2 || name.length > 40) {
        throw new BadRequestException('Give the shift a name of 2 to 40 letters.');
      }
      values.name = name;
    }
    if (body.startTime !== undefined || !partial) {
      if (!isClock(body.startTime)) throw new BadRequestException('Say when the shift starts, like 07:00.');
      values.startTime = body.startTime;
    }
    if (body.endTime !== undefined || !partial) {
      if (!isClock(body.endTime)) throw new BadRequestException('Say when the shift ends, like 15:00.');
      values.endTime = body.endTime;
    }
    if (body.graceMinutes !== undefined) {
      const grace = Math.round(Number(body.graceMinutes));
      if (!Number.isFinite(grace) || grace < 0 || grace > 120) {
        throw new BadRequestException('The grace period is between 0 and 120 minutes.');
      }
      values.graceMinutes = grace;
    }
    if (body.colorSlot !== undefined) {
      const slot = Math.round(Number(body.colorSlot));
      if (!Number.isFinite(slot) || slot < 1 || slot > 5) {
        throw new BadRequestException('Choose one of the five shift colours.');
      }
      values.colorSlot = slot;
    }
    return values;
  }

  async createShift(ws: WorkspaceAccess, body: ShiftBody): Promise<ShiftDto> {
    const values = this.read(body, false) as ShiftValues;
    if (await this.time.shiftNameTaken(ws.workspaceId, values.name)) {
      throw new ConflictException(`There is already a shift called ${values.name}.`);
    }
    const existing = await this.time.listShifts(ws.workspaceId);
    return shiftDto(
      await this.time.createShift(ws.workspaceId, {
        ...values,
        graceMinutes: values.graceMinutes ?? 10,
        // The next colour round the ramp, so a new shift does not wear the last one's.
        colorSlot: values.colorSlot ?? (existing.filter((s) => s.isActive).length % 5) + 1,
      }),
    );
  }

  async updateShift(ws: WorkspaceAccess, shiftId: string, body: ShiftBody): Promise<ShiftDto> {
    const values = this.read(body, true);
    if (values.name && (await this.time.shiftNameTaken(ws.workspaceId, values.name, shiftId))) {
      throw new ConflictException(`There is already a shift called ${values.name}.`);
    }
    const row = await this.time.updateShift(ws.workspaceId, shiftId, values);
    if (!row) throw new NotFoundException('That shift is not one of yours.');
    return shiftDto(row);
  }

  /** Stop offering a shift. Past weeks and clock records keep pointing at it. */
  async retireShift(ws: WorkspaceAccess, shiftId: string): Promise<void> {
    const row = await this.time.updateShift(ws.workspaceId, shiftId, { isActive: false });
    if (!row) throw new NotFoundException('That shift is not one of yours.');
  }

  /** Seven days of roster, with everything the grid is drawn from. */
  async week(ws: WorkspaceAccess, day?: string): Promise<RosterWeek> {
    if (day !== undefined && !isDay(day)) throw new BadRequestException('Choose a week.');
    const today = kigaliDay();
    const from = mondayOf(day ?? today);
    const to = addDays(from, 6);

    const [people, shifts, assignments, leave] = await Promise.all([
      this.employees.listForWorkspace(ws.workspaceId),
      this.time.listShifts(ws.workspaceId),
      this.time.listAssignments(ws.workspaceId, from, to),
      this.time.approvedLeave(ws.workspaceId, from, to),
    ]);

    return {
      from,
      to,
      today,
      days: Array.from({ length: 7 }, (_, i) => addDays(from, i)),
      shifts: shifts.map(shiftDto),
      people: people
        .map((p) => ({
          departmentMemberId: p.departmentMemberId,
          userId: p.userId,
          name: p.name,
          jobTitle: p.jobTitle,
          departmentName: p.departmentName,
        }))
        .sort(
          (a, b) =>
            (a.departmentName ?? '').localeCompare(b.departmentName ?? '') || (a.name ?? '').localeCompare(b.name ?? ''),
        ),
      assignments,
      leave,
    };
  }

  /** Put one person on one shift for one day, or clear the day with a null shift. */
  async assign(
    ws: WorkspaceAccess,
    userId: string,
    body: { departmentMemberId?: string; workDate?: string; shiftId?: string | null },
  ): Promise<void> {
    if (!body.departmentMemberId || !isDay(body.workDate)) {
      throw new BadRequestException('Choose a person and a day.');
    }
    if (!(await this.time.activeMember(ws.workspaceId, body.departmentMemberId))) {
      throw new NotFoundException('That employee is not on your roster.');
    }
    if (!body.shiftId) {
      await this.time.unassign(ws.workspaceId, body.departmentMemberId, body.workDate);
      return;
    }
    const shift = await this.time.findShift(ws.workspaceId, body.shiftId);
    if (!shift || !shift.isActive) throw new NotFoundException('That shift is no longer offered.');

    const leave = await this.time.approvedLeave(ws.workspaceId, body.workDate, body.workDate);
    if (leave.some((l) => l.departmentMemberId === body.departmentMemberId)) {
      throw new ConflictException('They are on approved leave that day.');
    }
    await this.time.assign(ws.workspaceId, body.departmentMemberId, body.workDate, shift.id, userId);
  }

  /**
   * Write one week from another, day for day. Only empty days are filled, a
   * retired shift is not carried over, and neither is a day the person is on
   * approved leave.
   */
  async copyWeek(
    ws: WorkspaceAccess,
    userId: string,
    body: { from?: string; to?: string },
  ): Promise<{ copied: number; skipped: number }> {
    if (!isDay(body.from) || !isDay(body.to)) throw new BadRequestException('Choose the week to copy and the week to fill.');
    const source = mondayOf(body.from);
    const target = mondayOf(body.to);
    if (source === target) throw new BadRequestException('Choose two different weeks.');
    const shift = Math.round((Date.parse(target) - Date.parse(source)) / 86_400_000);

    const [assignments, shifts, leave] = await Promise.all([
      this.time.listAssignments(ws.workspaceId, source, addDays(source, 6)),
      this.time.listShifts(ws.workspaceId),
      this.time.approvedLeave(ws.workspaceId, target, addDays(target, 6)),
    ]);
    const offered = new Set(shifts.filter((s) => s.isActive).map((s) => s.id));
    const onLeave = (memberId: string, day: string): boolean =>
      leave.some((l) => l.departmentMemberId === memberId && l.startDate <= day && day <= l.endDate);

    const rows = assignments
      .filter((a) => offered.has(a.shiftId))
      .map((a) => ({ departmentMemberId: a.departmentMemberId, shiftId: a.shiftId, workDate: addDays(a.workDate, shift) }))
      .filter((row) => !onLeave(row.departmentMemberId, row.workDate));

    const copied = await this.time.assignWhereEmpty(ws.workspaceId, rows, userId);
    return { copied, skipped: assignments.length - copied };
  }
}
