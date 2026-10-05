import {
  ATTENDANCE_LIST,
  ROSTER_LIST,
  type AttendanceSource,
  type AttendanceStatus,
  type ListQuery,
  type RosterStatus,
  type ShiftTemplateStatus,
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
import {
  compileListQuery,
  countAll,
  groupOrder,
  groupsOf,
  statusCountsOf,
  type ListColumns,
  type ListRows,
} from '../../../shared/lists/list-query';
import type { Tx } from './employees.repository';
import { refLabels } from './hr-labels';

/** A person's name as every HR list shows and searches it: the preferred one, else the legal one. */
const personName = sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;

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

  /** The roster list's one field to column map (`ROSTER_LIST`, 058-list-framework). */
  private readonly rosterListColumns: ListColumns = {
    workDate: rosterEntries.workDate,
    startsAt: rosterEntries.startsAt,
    employee: personName,
    shift: rosterEntries.shiftTemplateId,
    branch: rosterEntries.propertyId,
    department: rosterEntries.departmentId,
    status: rosterEntries.status,
  };

  /**
   * One page of the roster in the caller's branches (AC-T6, AC-LF3). `window`,
   * when given, bounds the days read: the service passes this week when the
   * query names no day, so the lens opens on the week rather than on every
   * shift ever planned. A roster carries no sensitive field, so every reader
   * reads it the same way.
   */
  async listRosterPage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
    window: { from: string; to: string } | null;
  }): Promise<ListRows<RosterEntryRow>> {
    const compiled = compileListQuery({
      spec: ROSTER_LIST,
      columns: this.rosterListColumns,
      reader: 'basic',
      query: input.query,
      tieBreaker: rosterEntries.id,
    });
    const own = and(
      eq(rosterEntries.orgId, input.orgId),
      inBranchScope(rosterEntries.propertyId, input.scope),
      ...(input.window
        ? [gte(rosterEntries.workDate, input.window.from), lte(rosterEntries.workDate, input.window.to)]
        : []),
    );
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.entries().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(rosterEntries)
        .innerJoin(employees, eq(employees.id, rosterEntries.employeeId))
        .where(where),
      this.db
        .select({ value: rosterEntries.status, count: countAll })
        .from(rosterEntries)
        .innerJoin(employees, eq(employees.id, rosterEntries.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(rosterEntries.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(rosterEntries)
            .innerJoin(employees, eq(employees.id, rosterEntries.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows,
      total: Number(count),
      groups: groupsOf(ROSTER_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
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

  /** The attendance list's one field to column map (`ATTENDANCE_LIST`, 058-list-framework). */
  private readonly attendanceListColumns: ListColumns = {
    workDate: attendanceRecords.workDate,
    clockInAt: attendanceRecords.clockInAt,
    employee: personName,
    branch: employees.workPropertyId,
    status: attendanceRecords.status,
    source: attendanceRecords.source,
    validated: attendanceRecords.validated,
  };

  /**
   * One page of attendance in the caller's branches (AC-LF3). `sheetDay`, when
   * given, makes it a day's sheet: every record dated that day, and every
   * record still OPEN whatever its date, so a night shift that began yesterday
   * is on today's sheet to be clocked out. The service passes today when the
   * query names no day.
   */
  async listAttendancePage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
    sheetDay: string | null;
  }): Promise<ListRows<AttendanceRow>> {
    const compiled = compileListQuery({
      spec: ATTENDANCE_LIST,
      columns: this.attendanceListColumns,
      reader: 'basic',
      query: input.query,
      tieBreaker: attendanceRecords.id,
    });
    const own = and(
      eq(attendanceRecords.orgId, input.orgId),
      inBranchScope(employees.workPropertyId, input.scope),
      ...(input.sheetDay
        ? [or(eq(attendanceRecords.workDate, input.sheetDay), eq(attendanceRecords.status, 'open'))]
        : []),
    );
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.records().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(attendanceRecords)
        .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
        .where(where),
      this.db
        .select({ value: attendanceRecords.status, count: countAll })
        .from(attendanceRecords)
        .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(attendanceRecords.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(attendanceRecords)
            .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows,
      total: Number(count),
      groups: groupsOf(ATTENDANCE_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
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
