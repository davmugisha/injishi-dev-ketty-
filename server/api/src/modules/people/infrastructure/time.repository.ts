import {
  ATTENDANCE_LIST,
  ROSTER_LIST,
  type AttendanceSource,
  type AttendanceStatus,
  type DayKind,
  type ListQuery,
  type RosterStatus,
  type ShiftTemplateStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import {
  attendanceKiosks,
  attendanceRecords,
  departments,
  employees,
  jobPositions,
  properties,
  rosterEntries,
  rosterPublications,
  shiftTemplates,
  users,
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
  minWorkMinutes: number | null;
  autoClockOutMinutes: number | null;
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
  breakMinutes: number;
  minWorkMinutes: number | null;
  autoClockOutMinutes: number | null;
  propertyId: string;
  departmentId: string | null;
  workDate: string;
  startsAt: Date;
  endsAt: Date;
  status: RosterStatus;
  cancelReason: string | null;
  publishedAt: Date | null;
  rotationAssignmentId: string | null;
  shiftRequestId: string | null;
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
  inAccuracyM: number | null;
  inDistanceM: number | null;
  outAccuracyM: number | null;
  outDistanceM: number | null;
  kioskId: string | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  approvedOvertimeMinutes: number | null;
  dayKind: DayKind | null;
  autoClosed: boolean;
}

/** What closing a record stores beside its clock out (058-time AC-TM7). */
export interface CloseValues {
  lateMinutes: number | null;
  earlyMinutes: number | null;
  workedMinutes: number;
  overtimeMinutes: number | null;
  approvedOvertimeMinutes: number | null;
  /** Null while the year's national holidays are not recorded. */
  dayKind: DayKind | null;
}

/** Where a phone punch was, and how far from the branch (AC-TM9). */
export interface PunchLocation {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceM: number | null;
}

export interface PublicationRow {
  id: string;
  propertyId: string;
  departmentId: string | null;
  fromDate: string;
  toDate: string;
  entryCount: number;
  publishedAt: Date;
  publishedByName: string | null;
}

/** An open record the sweep may close (AC-TM4), with what it needs to decide. */
export interface SweepCandidate {
  id: string;
  orgId: string;
  employeeId: string;
  workPropertyId: string | null;
  clockInAt: Date;
  rosterEntryId: string | null;
  entryEndsAt: Date | null;
  autoClockOutMinutes: number | null;
}

/**
 * Shift templates, the roster and attendance (ADR-058, 058-time). The only
 * place that touches Drizzle for them.
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
    minWorkMinutes: shiftTemplates.minWorkMinutes,
    autoClockOutMinutes: shiftTemplates.autoClockOutMinutes,
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

  async findTemplates(ids: readonly string[], tx?: Tx): Promise<ShiftTemplateRow[]> {
    if (ids.length === 0) return [];
    return (tx ?? this.db)
      .select(this.templateColumns)
      .from(shiftTemplates)
      .where(inArray(shiftTemplates.id, [...ids]));
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
    breakMinutes: shiftTemplates.breakMinutes,
    minWorkMinutes: shiftTemplates.minWorkMinutes,
    autoClockOutMinutes: shiftTemplates.autoClockOutMinutes,
    propertyId: rosterEntries.propertyId,
    departmentId: rosterEntries.departmentId,
    workDate: rosterEntries.workDate,
    startsAt: rosterEntries.startsAt,
    endsAt: rosterEntries.endsAt,
    status: rosterEntries.status,
    cancelReason: rosterEntries.cancelReason,
    publishedAt: rosterEntries.publishedAt,
    rotationAssignmentId: rosterEntries.rotationAssignmentId,
    shiftRequestId: rosterEntries.shiftRequestId,
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
   * shift ever planned. `publishedOnly` keeps drafts from a reader who does not
   * manage the roster (058-time AC-TM1).
   */
  async listRosterPage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
    window: { from: string; to: string } | null;
    publishedOnly: boolean;
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
      ...(input.publishedOnly ? [sql`${rosterEntries.publishedAt} IS NOT NULL`] : []),
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

  /** One branch's entries over a few days, drafts and cancelled ones included, for the week grid. */
  async weekEntries(input: { orgId: string; propertyId: string; from: string; to: string }): Promise<RosterEntryRow[]> {
    return this.entries()
      .where(
        and(
          eq(rosterEntries.orgId, input.orgId),
          eq(rosterEntries.propertyId, input.propertyId),
          gte(rosterEntries.workDate, input.from),
          lte(rosterEntries.workDate, input.to),
        ),
      )
      .orderBy(asc(rosterEntries.workDate), asc(rosterEntries.startsAt), asc(personName));
  }

  /** A person's entries in a range: published only for their own view (AC-TM2), every one otherwise. */
  async personEntries(input: {
    employeeIds: readonly string[];
    from: string;
    to: string;
    publishedOnly: boolean;
  }): Promise<RosterEntryRow[]> {
    if (input.employeeIds.length === 0) return [];
    const where = [
      inArray(rosterEntries.employeeId, [...input.employeeIds]),
      gte(rosterEntries.workDate, input.from),
      lte(rosterEntries.workDate, input.to),
    ];
    if (input.publishedOnly) where.push(sql`${rosterEntries.publishedAt} IS NOT NULL`);
    return this.entries()
      .where(and(...where))
      .orderBy(asc(rosterEntries.workDate), asc(rosterEntries.startsAt));
  }

  async findEntry(id: string, tx?: Tx): Promise<RosterEntryRow | null> {
    const [row] = await this.entries(tx).where(eq(rosterEntries.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * A person's scheduled entries whose link window could hold an instant
   * (058-time AC-TM15): starting no later than 12 hours after it, ending no
   * earlier than it.
   */
  async linkCandidates(employeeId: string, at: Date, tx?: Tx): Promise<RosterEntryRow[]> {
    return this.entries(tx).where(
      and(
        eq(rosterEntries.employeeId, employeeId),
        eq(rosterEntries.status, 'scheduled'),
        gte(rosterEntries.endsAt, at),
        lte(rosterEntries.startsAt, new Date(at.getTime() + 12 * 3_600_000)),
      ),
    );
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
      createdByUserId: string | null;
      publishedAt: Date | null;
      rotationAssignmentId?: string | null;
      shiftRequestId?: string | null;
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

  /** The scheduled entries of some people on some dates, for a swap or a change to replace (AC-TM5). */
  async scheduledOn(employeeIds: readonly string[], from: string, to: string, tx?: Tx): Promise<RosterEntryRow[]> {
    if (employeeIds.length === 0) return [];
    return this.entries(tx).where(
      and(
        inArray(rosterEntries.employeeId, [...employeeIds]),
        eq(rosterEntries.status, 'scheduled'),
        gte(rosterEntries.workDate, from),
        lte(rosterEntries.workDate, to),
      ),
    );
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

  // --- Publishing (058-time AC-TM1) -------------------------------------------------

  /**
   * Stamp every scheduled draft of a branch (and a department) in a range as
   * published, now. Answers the people whose shifts were published, so each
   * can be told once.
   */
  async publishDrafts(
    tx: Tx,
    input: { orgId: string; propertyId: string; departmentId: string | null; from: string; to: string; at: Date },
  ): Promise<{ count: number; employeeIds: string[] }> {
    const where = [
      eq(rosterEntries.orgId, input.orgId),
      eq(rosterEntries.propertyId, input.propertyId),
      eq(rosterEntries.status, 'scheduled'),
      isNull(rosterEntries.publishedAt),
      gte(rosterEntries.workDate, input.from),
      lte(rosterEntries.workDate, input.to),
    ];
    if (input.departmentId) where.push(eq(rosterEntries.departmentId, input.departmentId));
    const rows = await tx
      .update(rosterEntries)
      .set({ publishedAt: input.at, updatedAt: new Date() })
      .where(and(...where))
      .returning({ employeeId: rosterEntries.employeeId });
    return { count: rows.length, employeeIds: [...new Set(rows.map((r) => r.employeeId))] };
  }

  async insertPublication(
    tx: Tx,
    values: {
      orgId: string;
      propertyId: string;
      departmentId: string | null;
      fromDate: string;
      toDate: string;
      entryCount: number;
      publishedByUserId: string;
      publishedAt: Date;
    },
  ): Promise<string> {
    const [row] = await tx.insert(rosterPublications).values(values).returning({ id: rosterPublications.id });
    return row.id;
  }

  /**
   * Has a publish already covered this date for this branch? Then a shift
   * written there now is published at once (AC-TM1): a published week does not
   * grow private corners. A department publish covers its department only.
   */
  async isPublishedDate(input: { orgId: string; propertyId: string; departmentId: string | null; date: string }, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: rosterPublications.id })
      .from(rosterPublications)
      .where(
        and(
          eq(rosterPublications.orgId, input.orgId),
          eq(rosterPublications.propertyId, input.propertyId),
          lte(rosterPublications.fromDate, input.date),
          gte(rosterPublications.toDate, input.date),
          input.departmentId
            ? or(isNull(rosterPublications.departmentId), eq(rosterPublications.departmentId, input.departmentId))
            : isNull(rosterPublications.departmentId),
        ),
      )
      .limit(1);
    return !!row;
  }

  /** The publishes of a branch that touch a range, newest first. */
  async publications(input: { orgId: string; propertyId: string; from: string; to: string }): Promise<PublicationRow[]> {
    return this.db
      .select({
        id: rosterPublications.id,
        propertyId: rosterPublications.propertyId,
        departmentId: rosterPublications.departmentId,
        fromDate: rosterPublications.fromDate,
        toDate: rosterPublications.toDate,
        entryCount: rosterPublications.entryCount,
        publishedAt: rosterPublications.publishedAt,
        publishedByName: users.name,
      })
      .from(rosterPublications)
      .leftJoin(users, eq(users.id, rosterPublications.publishedByUserId))
      .where(
        and(
          eq(rosterPublications.orgId, input.orgId),
          eq(rosterPublications.propertyId, input.propertyId),
          lte(rosterPublications.fromDate, input.to),
          gte(rosterPublications.toDate, input.from),
        ),
      )
      .orderBy(desc(rosterPublications.publishedAt))
      .limit(50);
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
    inAccuracyM: attendanceRecords.inAccuracyM,
    inDistanceM: attendanceRecords.inDistanceM,
    outAccuracyM: attendanceRecords.outAccuracyM,
    outDistanceM: attendanceRecords.outDistanceM,
    kioskId: attendanceRecords.kioskId,
    lateMinutes: attendanceRecords.lateMinutes,
    earlyMinutes: attendanceRecords.earlyMinutes,
    workedMinutes: attendanceRecords.workedMinutes,
    overtimeMinutes: attendanceRecords.overtimeMinutes,
    approvedOvertimeMinutes: attendanceRecords.approvedOvertimeMinutes,
    dayKind: attendanceRecords.dayKind,
    autoClosed: attendanceRecords.autoClosed,
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
    autoClosed: attendanceRecords.autoClosed,
    lateMinutes: attendanceRecords.lateMinutes,
    earlyMinutes: attendanceRecords.earlyMinutes,
    overtimeMinutes: attendanceRecords.overtimeMinutes,
    overtimePending: sql`(${attendanceRecords.overtimeMinutes} > 0 AND ${attendanceRecords.approvedOvertimeMinutes} IS NULL)`,
  };

  /**
   * One page of attendance in the caller's branches (AC-LF3). `sheetDay`, when
   * given, makes it a day's sheet: every record dated that day, and every
   * record still OPEN whatever its date, so a night shift that began yesterday
   * is on today's sheet to be clocked out. The service passes today when the
   * query names no day. `figures` says whether the caller is in the figure
   * audience (058-time AC-TM13); outside it, a figure filter is refused.
   */
  async listAttendancePage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
    sheetDay: string | null;
    figures: boolean;
  }): Promise<ListRows<AttendanceRow>> {
    const compiled = compileListQuery({
      spec: ATTENDANCE_LIST,
      columns: this.attendanceListColumns,
      reader: { view: 'basic', figures: input.figures },
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

  /** The latest punch of a person, in or out, for the kiosk's double tap rule (AC-TM10). */
  async lastPunchAt(employeeId: string, tx?: Tx): Promise<Date | null> {
    const [row] = await (tx ?? this.db)
      .select({ at: sql<Date>`greatest(${attendanceRecords.clockInAt}, coalesce(${attendanceRecords.clockOutAt}, ${attendanceRecords.clockInAt}))` })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employeeId, employeeId), sql`${attendanceRecords.status} <> 'superseded'`))
      .orderBy(desc(sql`greatest(${attendanceRecords.clockInAt}, coalesce(${attendanceRecords.clockOutAt}, ${attendanceRecords.clockInAt}))`))
      .limit(1);
    return row ? new Date(row.at) : null;
  }

  /** Does any live record of the person overlap these times? An open one counts to now. */
  async overlapsRecord(employeeId: string, from: Date, to: Date, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeId, employeeId),
          sql`${attendanceRecords.status} <> 'superseded'`,
          sql`${attendanceRecords.clockInAt} < ${to}`,
          sql`coalesce(${attendanceRecords.clockOutAt}, now()) > ${from}`,
        ),
      )
      .limit(1);
    return !!row;
  }

  /** People's records in a range, superseded ones left out, for self service, a team and insights. */
  async personRecords(input: { employeeIds: readonly string[]; from: string; to: string }, tx?: Tx): Promise<AttendanceRow[]> {
    if (input.employeeIds.length === 0) return [];
    return this.records(tx)
      .where(
        and(
          inArray(attendanceRecords.employeeId, [...input.employeeIds]),
          gte(attendanceRecords.workDate, input.from),
          lte(attendanceRecords.workDate, input.to),
          sql`${attendanceRecords.status} <> 'superseded'`,
        ),
      )
      .orderBy(asc(attendanceRecords.workDate), asc(attendanceRecords.clockInAt));
  }

  /** Every closed record of a business in a range, in the caller's branches, for the insights (AC-TM13). */
  async closedRecordsInScope(input: {
    orgId: string;
    scope: BranchScope;
    from: string;
    to: string;
    propertyId?: string;
  }): Promise<AttendanceRow[]> {
    const where = [
      eq(attendanceRecords.orgId, input.orgId),
      inBranchScope(employees.workPropertyId, input.scope),
      eq(attendanceRecords.status, 'closed'),
      gte(attendanceRecords.workDate, input.from),
      lte(attendanceRecords.workDate, input.to),
    ];
    if (input.propertyId) where.push(eq(employees.workPropertyId, input.propertyId));
    return this.records()
      .where(and(...where))
      .orderBy(asc(personName), asc(attendanceRecords.workDate));
  }

  /**
   * The minutes each person was rostered for in a range, breaks taken off:
   * the expected hours of a monthly summary (058-time AC-TM13). Scheduled
   * shifts only, drafts included, because a draft is still the plan. Either
   * named people, or everybody in the caller's branches.
   */
  async scheduledMinutes(input: {
    orgId: string;
    from: string;
    to: string;
    employeeIds?: readonly string[];
    scope?: BranchScope;
    propertyId?: string;
  }): Promise<{ employeeId: string; preferredName: string | null; legalName: string; jobPositionTitle: string | null; minutes: number }[]> {
    if (input.employeeIds && input.employeeIds.length === 0) return [];
    const where = [
      eq(rosterEntries.orgId, input.orgId),
      eq(rosterEntries.status, 'scheduled'),
      gte(rosterEntries.workDate, input.from),
      lte(rosterEntries.workDate, input.to),
    ];
    if (input.employeeIds) where.push(inArray(rosterEntries.employeeId, [...input.employeeIds]));
    if (input.scope) where.push(inBranchScope(employees.workPropertyId, input.scope));
    if (input.propertyId) where.push(eq(employees.workPropertyId, input.propertyId));
    const rows = await this.db
      .select({
        employeeId: rosterEntries.employeeId,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        jobPositionTitle: jobPositions.title,
        minutes: sql<number>`coalesce(sum(greatest(0, floor(extract(epoch from (${rosterEntries.endsAt} - ${rosterEntries.startsAt})) / 60) - ${shiftTemplates.breakMinutes})), 0)::int`,
      })
      .from(rosterEntries)
      .innerJoin(employees, eq(employees.id, rosterEntries.employeeId))
      .innerJoin(shiftTemplates, eq(shiftTemplates.id, rosterEntries.shiftTemplateId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(and(...where))
      .groupBy(rosterEntries.employeeId, employees.preferredName, employees.legalName, jobPositions.title);
    return rows.map((r) => ({ ...r, minutes: Number(r.minutes) }));
  }

  /** The shift name of each roster entry named, for a lateness row (058-time AC-TM13). */
  async shiftNamesOf(entryIds: readonly string[]): Promise<Map<string, string>> {
    if (entryIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: rosterEntries.id, name: shiftTemplates.name })
      .from(rosterEntries)
      .innerJoin(shiftTemplates, eq(shiftTemplates.id, rosterEntries.shiftTemplateId))
      .where(inArray(rosterEntries.id, [...new Set(entryIds)]));
    return new Map(rows.map((r) => [r.id, r.name]));
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
      recordedByUserId: string | null;
      validated: boolean;
      validatedByUserId: string | null;
      status: AttendanceStatus;
      supersedesId: string | null;
      note: string | null;
      kioskId?: string | null;
      inLocation?: PunchLocation | null;
      close?: CloseValues | null;
    },
  ): Promise<string> {
    const { inLocation, close, ...rest } = values;
    const [row] = await tx
      .insert(attendanceRecords)
      .values({
        ...rest,
        inLatitude: inLocation?.latitude?.toFixed(6) ?? null,
        inLongitude: inLocation?.longitude?.toFixed(6) ?? null,
        inAccuracyM: inLocation?.accuracyM ?? null,
        inDistanceM: inLocation?.distanceM ?? null,
        ...(close ? closeColumns(close) : {}),
      })
      .returning({ id: attendanceRecords.id });
    return row.id;
  }

  /**
   * Close an open record with its figures (AC-TM7), and where a phone said it
   * was. False when it was no longer open.
   */
  async closeRecord(
    tx: Tx,
    id: string,
    clockOutAt: Date,
    close: CloseValues,
    extra: { outLocation?: PunchLocation | null; autoClosed?: boolean; validated?: boolean; note?: string } = {},
  ): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({
        clockOutAt,
        status: 'closed',
        ...closeColumns(close),
        ...(extra.outLocation
          ? {
              outLatitude: extra.outLocation.latitude?.toFixed(6) ?? null,
              outLongitude: extra.outLocation.longitude?.toFixed(6) ?? null,
              outAccuracyM: extra.outLocation.accuracyM,
              outDistanceM: extra.outLocation.distanceM,
            }
          : {}),
        ...(extra.autoClosed ? { autoClosed: true } : {}),
        ...(extra.validated === false ? { validated: false, validatedByUserId: null } : {}),
        ...(extra.note ? { note: extra.note } : {}),
        updatedAt: new Date(),
      })
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

  /**
   * Validate a punch nobody vouched for: a self or phone clock in. A record the
   * sweep closed is put right by a correction instead (AC-TM4). False when it
   * was not one waiting.
   */
  async validate(tx: Tx, id: string, userId: string): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({ validated: true, validatedByUserId: userId, updatedAt: new Date() })
      .where(
        and(
          eq(attendanceRecords.id, id),
          inArray(attendanceRecords.source, ['self', 'phone']),
          eq(attendanceRecords.validated, false),
          eq(attendanceRecords.autoClosed, false),
          sql`${attendanceRecords.status} <> 'superseded'`,
        ),
      )
      .returning({ id: attendanceRecords.id });
    return rows.length > 0;
  }

  /** Approve or reduce a closed record's overtime (AC-TM8). False when it has none to decide. */
  async decideOvertime(tx: Tx, id: string, approvedMinutes: number): Promise<boolean> {
    const rows = await tx
      .update(attendanceRecords)
      .set({ approvedOvertimeMinutes: approvedMinutes, updatedAt: new Date() })
      .where(
        and(
          eq(attendanceRecords.id, id),
          eq(attendanceRecords.status, 'closed'),
          sql`${attendanceRecords.overtimeMinutes} > 0`,
          sql`${approvedMinutes} <= ${attendanceRecords.overtimeMinutes}`,
        ),
      )
      .returning({ id: attendanceRecords.id });
    return rows.length > 0;
  }

  /**
   * Open records the sweep may close (AC-TM4): linked to a shift whose template
   * closes them, or open longer than an hour, whose staleness the service
   * judges against each branch's policy.
   */
  async sweepCandidates(now: Date): Promise<SweepCandidate[]> {
    return this.db
      .select({
        id: attendanceRecords.id,
        orgId: attendanceRecords.orgId,
        employeeId: attendanceRecords.employeeId,
        workPropertyId: employees.workPropertyId,
        clockInAt: attendanceRecords.clockInAt,
        rosterEntryId: attendanceRecords.rosterEntryId,
        entryEndsAt: rosterEntries.endsAt,
        autoClockOutMinutes: shiftTemplates.autoClockOutMinutes,
      })
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .leftJoin(rosterEntries, eq(rosterEntries.id, attendanceRecords.rosterEntryId))
      .leftJoin(shiftTemplates, eq(shiftTemplates.id, rosterEntries.shiftTemplateId))
      .where(
        and(
          eq(attendanceRecords.status, 'open'),
          or(
            sql`${shiftTemplates.autoClockOutMinutes} IS NOT NULL AND ${rosterEntries.endsAt} + make_interval(mins => ${shiftTemplates.autoClockOutMinutes}) <= ${now}`,
            lte(attendanceRecords.clockInAt, new Date(now.getTime() - 3_600_000)),
          ),
        ),
      )
      .limit(1000);
  }

  // --- Branches ----------------------------------------------------------------

  /** A branch's name and coordinates, for the geofence (AC-TM9). */
  async branch(propertyId: string): Promise<{ id: string; orgId: string; name: string; latitude: number | null; longitude: number | null } | null> {
    const [row] = await this.db
      .select({
        id: properties.id,
        orgId: properties.orgId,
        name: properties.name,
        latitude: properties.latitude,
        longitude: properties.longitude,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    };
  }

  /** A kiosk's name, to say where a punch came from. */
  async kioskNames(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: attendanceKiosks.id, name: attendanceKiosks.name })
      .from(attendanceKiosks)
      .where(inArray(attendanceKiosks.id, [...ids]));
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}

function closeColumns(close: CloseValues): Record<string, unknown> {
  return {
    lateMinutes: close.lateMinutes,
    earlyMinutes: close.earlyMinutes,
    workedMinutes: close.workedMinutes,
    overtimeMinutes: close.overtimeMinutes,
    approvedOvertimeMinutes: close.approvedOvertimeMinutes,
    dayKind: close.dayKind,
  };
}
