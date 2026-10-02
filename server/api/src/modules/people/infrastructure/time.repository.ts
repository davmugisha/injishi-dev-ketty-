import type {
  AttendanceSource,
  AttendanceStatus,
  RosterStatus,
  ShiftTemplateStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';

import {
  attendanceRecords,
  departments,
  employees,
  jobPositions,
  rosterEntries,
  shiftTemplates,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Tx } from './employees.repository';

export interface ShiftTemplateRow {
  id: string;
  orgId: string;
  propertyId: string;
  departmentId: string | null;
  name: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  status: ShiftTemplateStatus;
}

/** A roster entry with the three fields of its person a roster may show. */
export interface RosterEntryRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  shiftTemplateId: string;
  shiftName: string;
  propertyId: string;
  departmentId: string | null;
  workDate: string;
  startsAt: Date;
  endsAt: Date;
  status: RosterStatus;
  cancelReason: string | null;
}

export interface AttendanceRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  rosterEntryId: string | null;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  source: AttendanceSource;
  validated: boolean;
  status: AttendanceStatus;
  supersedesId: string | null;
  note: string | null;
}

/**
 * Shift templates, the roster and attendance (ADR-058). The only place that
 * touches Drizzle for them.
 *
 * A roster or attendance read joins the file for exactly three things, the
 * roster card (id, names, position), and the branch the scope filters by. No
 * other file column is selected here, so nothing else can leave.
 */
@Injectable()
export class TimeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Shift templates -----------------------------------------------------

  private readonly templateColumns = {
    id: shiftTemplates.id,
    orgId: shiftTemplates.orgId,
    propertyId: shiftTemplates.propertyId,
    departmentId: shiftTemplates.departmentId,
    name: shiftTemplates.name,
    startsAt: shiftTemplates.startsAt,
    endsAt: shiftTemplates.endsAt,
    breakMinutes: shiftTemplates.breakMinutes,
    status: shiftTemplates.status,
  };

  async listTemplates(orgId: string, scope: BranchScope, propertyId?: string): Promise<ShiftTemplateRow[]> {
    const where = [
      eq(shiftTemplates.orgId, orgId),
      eq(shiftTemplates.status, 'active'),
      inBranchScope(shiftTemplates.propertyId, scope),
    ];
    if (propertyId) where.push(eq(shiftTemplates.propertyId, propertyId));
    return this.db
      .select(this.templateColumns)
      .from(shiftTemplates)
      .where(and(...where))
      .orderBy(asc(shiftTemplates.startsAt), asc(shiftTemplates.name));
  }

  async findTemplate(id: string, tx?: Tx): Promise<ShiftTemplateRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.templateColumns)
      .from(shiftTemplates)
      .where(eq(shiftTemplates.id, id))
      .limit(1);
    return row ?? null;
  }

  async findDepartment(id: string): Promise<{ id: string; orgId: string; propertyId: string | null } | null> {
    const [row] = await this.db
      .select({ id: departments.id, orgId: departments.orgId, propertyId: departments.propertyId })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return row ?? null;
  }

  async insertTemplate(
    tx: Tx,
    values: Omit<ShiftTemplateRow, 'id' | 'status'>,
  ): Promise<string> {
    const [row] = await tx
      .insert(shiftTemplates)
      .values(values)
      .returning({ id: shiftTemplates.id });
    return row.id;
  }

  // --- Roster --------------------------------------------------------------

  private readonly entryColumns = {
    id: rosterEntries.id,
    orgId: rosterEntries.orgId,
    employeeId: rosterEntries.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    shiftTemplateId: rosterEntries.shiftTemplateId,
    shiftName: shiftTemplates.name,
    propertyId: rosterEntries.propertyId,
    departmentId: rosterEntries.departmentId,
    workDate: rosterEntries.workDate,
    startsAt: rosterEntries.startsAt,
    endsAt: rosterEntries.endsAt,
    status: rosterEntries.status,
    cancelReason: rosterEntries.cancelReason,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private entries(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.entryColumns)
      .from(rosterEntries)
      .innerJoin(employees, eq(employees.id, rosterEntries.employeeId))
      .innerJoin(shiftTemplates, eq(shiftTemplates.id, rosterEntries.shiftTemplateId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  /** The roster between two dates, in the branches the caller covers (AC-T6). */
  async listRoster(input: {
    orgId: string;
    scope: BranchScope;
    from: string;
    to: string;
    propertyId?: string;
  }): Promise<RosterEntryRow[]> {
    const where = [
      eq(rosterEntries.orgId, input.orgId),
      gte(rosterEntries.workDate, input.from),
      lte(rosterEntries.workDate, input.to),
      inBranchScope(rosterEntries.propertyId, input.scope),
    ];
    if (input.propertyId) where.push(eq(rosterEntries.propertyId, input.propertyId));
    return this.entries()
      .where(and(...where))
      .orderBy(asc(rosterEntries.workDate), asc(rosterEntries.startsAt), asc(employees.legalName));
  }

  async findEntry(id: string, tx?: Tx): Promise<RosterEntryRow | null> {
    const [row] = await this.entries(tx).where(eq(rosterEntries.id, id)).limit(1);
    return row ?? null;
  }

  /** Throws the database's 23P01 when it overlaps a scheduled shift (AC-T2). */
  async insertEntry(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      shiftTemplateId: string;
      propertyId: string;
      departmentId: string | null;
      workDate: string;
      startsAt: Date;
      endsAt: Date;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(rosterEntries).values(values).returning({ id: rosterEntries.id });
    return row.id;
  }

  /** Cancel one entry, only while it is scheduled. False when it was not. */
  async cancelEntry(tx: Tx, id: string, reason: string): Promise<boolean> {
    const rows = await tx
      .update(rosterEntries)
      .set({ status: 'cancelled', cancelReason: reason, updatedAt: new Date() })
      .where(and(eq(rosterEntries.id, id), eq(rosterEntries.status, 'scheduled')))
      .returning({ id: rosterEntries.id });
    return rows.length > 0;
  }

  /**
   * Cancel a person's scheduled shifts on the dates `from` to `to` (both
   * included; `to` null for every later date). Approving leave (AC-T3) and
   * offboarding (AC-O1) both clear the roster this way.
   */
  async cancelScheduledBetween(
    tx: Tx,
    employeeId: string,
    from: string,
    to: string | null,
    reason: string,
  ): Promise<number> {
    const where = [
      eq(rosterEntries.employeeId, employeeId),
      eq(rosterEntries.status, 'scheduled'),
      gte(rosterEntries.workDate, from),
    ];
    if (to) where.push(lte(rosterEntries.workDate, to));
    const rows = await tx
      .update(rosterEntries)
      .set({ status: 'cancelled', cancelReason: reason, updatedAt: new Date() })
      .where(and(...where))
      .returning({ id: rosterEntries.id });
    return rows.length;
  }

  /** The dates in a range on which the person has a scheduled shift (AC-L3). */
  async rosteredDates(employeeId: string, from: string, to: string, tx?: Tx): Promise<Set<string>> {
    const rows = await (tx ?? this.db)
      .selectDistinct({ workDate: rosterEntries.workDate })
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.employeeId, employeeId),
          eq(rosterEntries.status, 'scheduled'),
          gte(rosterEntries.workDate, from),
          lte(rosterEntries.workDate, to),
        ),
      );
    return new Set(rows.map((r) => r.workDate));
  }

  // --- Attendance ----------------------------------------------------------

  private readonly recordColumns = {
    id: attendanceRecords.id,
    orgId: attendanceRecords.orgId,
    employeeId: attendanceRecords.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    rosterEntryId: attendanceRecords.rosterEntryId,
    workDate: attendanceRecords.workDate,
    clockInAt: attendanceRecords.clockInAt,
    clockOutAt: attendanceRecords.clockOutAt,
    source: attendanceRecords.source,
    validated: attendanceRecords.validated,
    status: attendanceRecords.status,
    supersedesId: attendanceRecords.supersedesId,
    note: attendanceRecords.note,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private records(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.recordColumns)
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  /**
   * A day's sheet: every record dated that day, and every record still OPEN
   * whatever its date, so a night shift that began yesterday is on today's
   * sheet to be clocked out.
   */
  async listAttendance(input: {
    orgId: string;
    scope: BranchScope;
    date: string;
    propertyId?: string;
  }): Promise<AttendanceRow[]> {
    const where = [
      eq(attendanceRecords.orgId, input.orgId),
      or(eq(attendanceRecords.workDate, input.date), eq(attendanceRecords.status, 'open')),
      inBranchScope(employees.workPropertyId, input.scope),
    ];
    if (input.propertyId) where.push(eq(employees.workPropertyId, input.propertyId));
    return this.records()
      .where(and(...where))
      .orderBy(asc(attendanceRecords.clockInAt));
  }

  async findRecord(id: string, tx?: Tx): Promise<AttendanceRow | null> {
    const [row] = await this.records(tx).where(eq(attendanceRecords.id, id)).limit(1);
    return row ?? null;
  }

  async findOpenRecord(employeeId: string, tx?: Tx): Promise<AttendanceRow | null> {
    const [row] = await this.records(tx)
      .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.status, 'open')))
      .limit(1);
    return row ?? null;
  }

  /** Throws 23505 on `attendance_records_one_open_uk` when one is already open. */
  async insertRecord(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      rosterEntryId: string | null;
      workDate: string;
      clockInAt: Date;
      clockOutAt: Date | null;
      source: AttendanceSource;
      recordedByUserId: string;
      validated: boolean;
      validatedByUserId: string | null;
      status: AttendanceStatus;
      supersedesId: string | null;
      note: string | null;
    },
  ): Promise<string> {
    const [row] = await tx
      .insert(attendanceRecords)
      .values(values)
      .returning({ id: attendanceRecords.id });
    return row.id;
  }

  /** Close an open record. False when it was no longer open. */
  async closeRecord(tx: Tx, id: string, clockOutAt: Date): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({ clockOutAt, status: 'closed', updatedAt: new Date() })
      .where(and(eq(attendanceRecords.id, id), eq(attendanceRecords.status, 'open')))
      .returning({ id: attendanceRecords.id });
    return rows.length > 0;
  }

  /** Mark the original of a correction superseded. False when it already was. */
  async supersede(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({ status: 'superseded', updatedAt: new Date() })
      .where(and(eq(attendanceRecords.id, id), inArray(attendanceRecords.status, ['open', 'closed'])))
      .returning({ id: attendanceRecords.id });
    return rows.length > 0;
  }

  /** Validate a self clock in. False when it was not a waiting self record. */
  async validate(tx: Tx, id: string, userId: string): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({ validated: true, validatedByUserId: userId, updatedAt: new Date() })
      .where(
        and(
          eq(attendanceRecords.id, id),
          eq(attendanceRecords.source, 'self'),
          eq(attendanceRecords.validated, false),
          sql`${attendanceRecords.status} <> 'superseded'`,
        ),
      )
      .returning({ id: attendanceRecords.id });
    return rows.length > 0;
  }
}
