import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { attendanceEntries, shiftAssignments, workShifts } from '../../../database/drizzle/hr-attendance';
import { leaveRequests } from '../../../database/drizzle/hr-lifecycle';
import { departmentMembers } from '../../../database/drizzle/operations';

export interface ShiftRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  colorSlot: number;
  isActive: boolean;
}

export interface AssignmentRow {
  id: string;
  departmentMemberId: string;
  shiftId: string;
  workDate: string;
}

export interface EntryRow {
  id: string;
  departmentMemberId: string;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  shiftId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  lateMinutes: number;
  source: 'self' | 'manual';
  note: string | null;
}

export interface ShiftValues {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  colorSlot: number;
}

const shiftColumns = {
  id: workShifts.id,
  name: workShifts.name,
  startTime: workShifts.startTime,
  endTime: workShifts.endTime,
  graceMinutes: workShifts.graceMinutes,
  colorSlot: workShifts.colorSlot,
  isActive: workShifts.isActive,
};

const entryColumns = {
  id: attendanceEntries.id,
  departmentMemberId: attendanceEntries.departmentMemberId,
  workDate: attendanceEntries.workDate,
  clockInAt: attendanceEntries.clockInAt,
  clockOutAt: attendanceEntries.clockOutAt,
  shiftId: attendanceEntries.shiftId,
  scheduledStart: attendanceEntries.scheduledStart,
  scheduledEnd: attendanceEntries.scheduledEnd,
  lateMinutes: attendanceEntries.lateMinutes,
  source: attendanceEntries.source,
  note: attendanceEntries.note,
};

/**
 * Shifts, the roster and clock records (HR module, Phase 5).
 *
 * EVERY WRITE NAMES THE WORKSPACE. A shift id, a member id and an entry id all
 * arrive from a request, so each `where` carries the workspace the guard
 * proved beside the id: an id that belongs to another business matches no row
 * rather than being changed.
 */
@Injectable()
export class AttendanceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Shifts ------------------------------------------------------------

  /** Active shifts first, in the order a day runs. Retired ones stay readable for past weeks. */
  async listShifts(workspaceId: string): Promise<ShiftRow[]> {
    return this.db
      .select(shiftColumns)
      .from(workShifts)
      .where(eq(workShifts.workspaceId, workspaceId))
      .orderBy(desc(workShifts.isActive), asc(workShifts.startTime), asc(workShifts.name));
  }

  async findShift(workspaceId: string, shiftId: string): Promise<ShiftRow | undefined> {
    const [row] = await this.db
      .select(shiftColumns)
      .from(workShifts)
      .where(and(eq(workShifts.id, shiftId), eq(workShifts.workspaceId, workspaceId)))
      .limit(1);
    return row;
  }

  async createShift(workspaceId: string, values: ShiftValues): Promise<ShiftRow> {
    const [row] = await this.db
      .insert(workShifts)
      .values({ workspaceId, ...values })
      .returning(shiftColumns);
    return row;
  }

  async updateShift(
    workspaceId: string,
    shiftId: string,
    values: Partial<ShiftValues> & { isActive?: boolean },
  ): Promise<ShiftRow | undefined> {
    const [row] = await this.db
      .update(workShifts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(workShifts.id, shiftId), eq(workShifts.workspaceId, workspaceId)))
      .returning(shiftColumns);
    return row;
  }

  // --- Roster ------------------------------------------------------------

  async listAssignments(workspaceId: string, from: string, to: string): Promise<AssignmentRow[]> {
    return this.db
      .select({
        id: shiftAssignments.id,
        departmentMemberId: shiftAssignments.departmentMemberId,
        shiftId: shiftAssignments.shiftId,
        workDate: shiftAssignments.workDate,
      })
      .from(shiftAssignments)
      // Somebody whose employment ended drops off the roster with everything else.
      .innerJoin(departmentMembers, eq(departmentMembers.id, shiftAssignments.departmentMemberId))
      .where(
        and(
          eq(shiftAssignments.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
          gte(shiftAssignments.workDate, from),
          lte(shiftAssignments.workDate, to),
        ),
      );
  }

  /** The caller's own assignments: the ids are ones the service resolved from the session. */
  async assignmentsForMembers(memberIds: readonly string[], from: string, to: string): Promise<AssignmentRow[]> {
    if (memberIds.length === 0) return [];
    return this.db
      .select({
        id: shiftAssignments.id,
        departmentMemberId: shiftAssignments.departmentMemberId,
        shiftId: shiftAssignments.shiftId,
        workDate: shiftAssignments.workDate,
      })
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.departmentMemberId, [...memberIds]),
          gte(shiftAssignments.workDate, from),
          lte(shiftAssignments.workDate, to),
        ),
      )
      .orderBy(asc(shiftAssignments.workDate));
  }

  /** Put somebody on a shift for a day, replacing whatever they were on. */
  async assign(
    workspaceId: string,
    departmentMemberId: string,
    workDate: string,
    shiftId: string,
    userId: string,
  ): Promise<void> {
    await this.db
      .insert(shiftAssignments)
      .values({ workspaceId, departmentMemberId, workDate, shiftId, assignedByUserId: userId })
      .onConflictDoUpdate({
        target: [shiftAssignments.departmentMemberId, shiftAssignments.workDate],
        set: { shiftId, assignedByUserId: userId, updatedAt: new Date() },
      });
  }

  async unassign(workspaceId: string, departmentMemberId: string, workDate: string): Promise<void> {
    await this.db
      .delete(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.workspaceId, workspaceId),
          eq(shiftAssignments.departmentMemberId, departmentMemberId),
          eq(shiftAssignments.workDate, workDate),
        ),
      );
  }

  /**
   * Fill days that are still empty. A day somebody is already rostered on is
   * left as it is, so copying last week never overwrites a change made by hand.
   */
  async assignWhereEmpty(
    workspaceId: string,
    rows: readonly { departmentMemberId: string; workDate: string; shiftId: string }[],
    userId: string,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const written = await this.db
      .insert(shiftAssignments)
      .values(rows.map((row) => ({ ...row, workspaceId, assignedByUserId: userId })))
      .onConflictDoNothing({ target: [shiftAssignments.departmentMemberId, shiftAssignments.workDate] })
      .returning({ id: shiftAssignments.id });
    return written.length;
  }

  // --- Clock records -----------------------------------------------------

  async listEntries(workspaceId: string, from: string, to: string): Promise<EntryRow[]> {
    return this.db
      .select(entryColumns)
      .from(attendanceEntries)
      .innerJoin(departmentMembers, eq(departmentMembers.id, attendanceEntries.departmentMemberId))
      .where(
        and(
          eq(attendanceEntries.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
          gte(attendanceEntries.workDate, from),
          lte(attendanceEntries.workDate, to),
        ),
      );
  }

  async entriesForMembers(memberIds: readonly string[], from: string, to: string): Promise<EntryRow[]> {
    if (memberIds.length === 0) return [];
    return this.db
      .select(entryColumns)
      .from(attendanceEntries)
      .where(
        and(
          inArray(attendanceEntries.departmentMemberId, [...memberIds]),
          gte(attendanceEntries.workDate, from),
          lte(attendanceEntries.workDate, to),
        ),
      )
      .orderBy(desc(attendanceEntries.workDate));
  }

  /** The record somebody is still clocked in on, whichever day it began. */
  async openEntry(memberIds: readonly string[]): Promise<EntryRow | undefined> {
    if (memberIds.length === 0) return undefined;
    const [row] = await this.db
      .select(entryColumns)
      .from(attendanceEntries)
      .where(and(inArray(attendanceEntries.departmentMemberId, [...memberIds]), isNull(attendanceEntries.clockOutAt)))
      .orderBy(desc(attendanceEntries.clockInAt))
      .limit(1);
    return row;
  }

  async findEntry(departmentMemberId: string, workDate: string): Promise<EntryRow | undefined> {
    const [row] = await this.db
      .select(entryColumns)
      .from(attendanceEntries)
      .where(and(eq(attendanceEntries.departmentMemberId, departmentMemberId), eq(attendanceEntries.workDate, workDate)))
      .limit(1);
    return row;
  }

  async clockIn(values: {
    workspaceId: string;
    departmentMemberId: string;
    workDate: string;
    clockInAt: Date;
    shiftId: string | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    lateMinutes: number;
    recordedByUserId: string;
  }): Promise<EntryRow | undefined> {
    const [row] = await this.db
      .insert(attendanceEntries)
      .values({ ...values, source: 'self' })
      // Two presses of the button land on the unique key; the second writes nothing.
      .onConflictDoNothing({ target: [attendanceEntries.departmentMemberId, attendanceEntries.workDate] })
      .returning(entryColumns);
    return row;
  }

  /** Close a record that is still open. Answers nothing when it was already closed. */
  async clockOut(entryId: string, at: Date): Promise<EntryRow | undefined> {
    const [row] = await this.db
      .update(attendanceEntries)
      .set({ clockOutAt: at, updatedAt: new Date() })
      .where(and(eq(attendanceEntries.id, entryId), isNull(attendanceEntries.clockOutAt)))
      .returning(entryColumns);
    return row;
  }

  /** HR writes a day's record, or replaces the one that is there. */
  async writeEntry(values: {
    workspaceId: string;
    departmentMemberId: string;
    workDate: string;
    clockInAt: Date;
    clockOutAt: Date | null;
    shiftId: string | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    lateMinutes: number;
    note: string | null;
    recordedByUserId: string;
  }): Promise<EntryRow> {
    const { workspaceId, departmentMemberId, workDate, ...rest } = values;
    const [row] = await this.db
      .insert(attendanceEntries)
      .values({ workspaceId, departmentMemberId, workDate, ...rest, source: 'manual' })
      .onConflictDoUpdate({
        target: [attendanceEntries.departmentMemberId, attendanceEntries.workDate],
        set: { ...rest, source: 'manual', updatedAt: new Date() },
      })
      .returning(entryColumns);
    return row;
  }

  async deleteEntry(workspaceId: string, entryId: string): Promise<boolean> {
    const rows = await this.db
      .delete(attendanceEntries)
      .where(and(eq(attendanceEntries.id, entryId), eq(attendanceEntries.workspaceId, workspaceId)))
      .returning({ id: attendanceEntries.id });
    return rows.length > 0;
  }

  // --- What the two are read against --------------------------------------

  /** Approved leave that touches a stretch of days: nobody on leave is "absent". */
  async approvedLeave(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<{ departmentMemberId: string; leaveType: string; startDate: string; endDate: string }[]> {
    return this.db
      .select({
        departmentMemberId: leaveRequests.departmentMemberId,
        // Which kind of leave: payroll takes nothing off for paid leave.
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.workspaceId, workspaceId),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startDate, to),
          gte(leaveRequests.endDate, from),
        ),
      );
  }

  /** Whether an id is one of this workspace's employees who still works here. */
  async activeMember(workspaceId: string, departmentMemberId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: departmentMembers.id })
      .from(departmentMembers)
      .where(
        and(
          eq(departmentMembers.id, departmentMemberId),
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /** Whether another active shift already carries this name, whatever its capitals. */
  async shiftNameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: workShifts.id })
      .from(workShifts)
      .where(
        and(
          eq(workShifts.workspaceId, workspaceId),
          eq(workShifts.isActive, true),
          sql`lower(${workShifts.name}) = lower(${name})`,
        ),
      );
    return rows.some((row) => row.id !== exceptId);
  }
}
