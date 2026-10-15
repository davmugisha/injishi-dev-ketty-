import {
  ATTENDANCE_REQUEST_LIST,
  MAX_BULK_IDS,
  SHIFT_REQUEST_LIST,
  type AttendanceRequestStatus,
  type ListIds,
  type ListQuery,
  type ShiftRequestKind,
  type ShiftRequestStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  attendanceRequests,
  employees,
  jobPositions,
  shiftRequests,
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

const swapPerson = alias(employees, 'swap_person');
const swapPosition = alias(jobPositions, 'swap_position');
const routedPerson = alias(employees, 'routed_person');
const routedPosition = alias(jobPositions, 'routed_position');
const decider = alias(users, 'decider');

const personName = sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;

/** A person as a request shows them: the roster card's three fields. */
export interface CardFields {
  id: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
}

export interface ShiftRequestRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  kind: ShiftRequestKind;
  shiftTemplateId: string | null;
  shiftTemplateName: string | null;
  swapEmployeeId: string | null;
  swapPreferredName: string | null;
  swapLegalName: string | null;
  swapPositionTitle: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: ShiftRequestStatus;
  colleagueAcceptedAt: Date | null;
  routedToEmployeeId: string | null;
  routedPreferredName: string | null;
  routedLegalName: string | null;
  routedPositionTitle: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: Date;
}

export interface AttendanceRequestRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date;
  recordId: string | null;
  reason: string;
  status: AttendanceRequestStatus;
  routedToEmployeeId: string | null;
  routedPreferredName: string | null;
  routedLegalName: string | null;
  routedPositionTitle: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  resultRecordId: string | null;
  createdAt: Date;
  // real-data, people: what backs the ask, the manager who confirmed it, and the record as it stands.
  evidence: string | null;
  managerConfirmedAt: Date | null;
  managerConfirmedByName: string | null;
  recordClockInAt: Date | string | null;
  recordClockOutAt: Date | string | null;
}

function routedToMe(column: SQL | typeof shiftRequests.routedToEmployeeId, me: string | null): SQL {
  // Always a comparison with a bound parameter, never a bare constant: Postgres
  // refuses a constant in ORDER BY (the slice 2 lesson).
  return sql`coalesce(${column} = ${me}::uuid, false)`;
}

/**
 * Shift and swap requests, and attendance requests (ADR-058, 058-time AC-TM5,
 * AC-TM6). The only place that touches Drizzle for them. A request ends
 * approved, refused or cancelled; none is deleted.
 */
@Injectable()
export class TimeRequestsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Shift requests --------------------------------------------------------------

  private readonly shiftColumns = {
    id: shiftRequests.id,
    orgId: shiftRequests.orgId,
    employeeId: shiftRequests.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    kind: shiftRequests.kind,
    shiftTemplateId: shiftRequests.shiftTemplateId,
    shiftTemplateName: shiftTemplates.name,
    swapEmployeeId: shiftRequests.swapEmployeeId,
    swapPreferredName: swapPerson.preferredName,
    swapLegalName: swapPerson.legalName,
    swapPositionTitle: swapPosition.title,
    fromDate: shiftRequests.fromDate,
    toDate: shiftRequests.toDate,
    reason: shiftRequests.reason,
    status: shiftRequests.status,
    colleagueAcceptedAt: shiftRequests.colleagueAcceptedAt,
    routedToEmployeeId: shiftRequests.routedToEmployeeId,
    routedPreferredName: routedPerson.preferredName,
    routedLegalName: routedPerson.legalName,
    routedPositionTitle: routedPosition.title,
    decidedAt: shiftRequests.decidedAt,
    decidedByName: decider.name,
    decisionNote: shiftRequests.decisionNote,
    createdAt: shiftRequests.createdAt,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private shift(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.shiftColumns)
      .from(shiftRequests)
      .innerJoin(employees, eq(employees.id, shiftRequests.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(shiftTemplates, eq(shiftTemplates.id, shiftRequests.shiftTemplateId))
      .leftJoin(swapPerson, eq(swapPerson.id, shiftRequests.swapEmployeeId))
      .leftJoin(swapPosition, eq(swapPosition.id, swapPerson.jobPositionId))
      .leftJoin(routedPerson, eq(routedPerson.id, shiftRequests.routedToEmployeeId))
      .leftJoin(routedPosition, eq(routedPosition.id, routedPerson.jobPositionId))
      .leftJoin(decider, eq(decider.id, shiftRequests.decidedByUserId));
  }

  private shiftListColumns(me: string | null): ListColumns {
    return {
      employee: personName,
      fromDate: shiftRequests.fromDate,
      toDate: shiftRequests.toDate,
      kind: shiftRequests.kind,
      status: shiftRequests.status,
      branch: employees.workPropertyId,
      routedToMe: routedToMe(shiftRequests.routedToEmployeeId, me),
      createdAt: shiftRequests.createdAt,
    };
  }

  private compiledShift(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): {
    where: SQL | undefined;
    own: SQL | undefined;
    compiled: ReturnType<typeof compileListQuery>;
  } {
    const compiled = compileListQuery({
      spec: SHIFT_REQUEST_LIST,
      columns: this.shiftListColumns(input.me),
      reader: 'basic',
      query: input.query,
      tieBreaker: shiftRequests.id,
    });
    const own = and(eq(shiftRequests.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  async shiftPage(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListRows<ShiftRequestRow>> {
    const { compiled, own, where } = this.compiledShift(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.shift().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db.select({ count: countAll }).from(shiftRequests).innerJoin(employees, eq(employees.id, shiftRequests.employeeId)).where(where),
      this.db
        .select({ value: shiftRequests.status, count: countAll })
        .from(shiftRequests)
        .innerJoin(employees, eq(employees.id, shiftRequests.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(shiftRequests.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(shiftRequests)
            .innerJoin(employees, eq(employees.id, shiftRequests.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as ShiftRequestRow[],
      total: Number(count),
      groups: groupsOf(SHIFT_REQUEST_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async shiftIds(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListIds> {
    const { compiled, where } = this.compiledShift(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: shiftRequests.id })
        .from(shiftRequests)
        .innerJoin(employees, eq(employees.id, shiftRequests.employeeId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.db.select({ count: countAll }).from(shiftRequests).innerJoin(employees, eq(employees.id, shiftRequests.employeeId)).where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async findShift(id: string, tx?: Tx): Promise<ShiftRequestRow | null> {
    const [row] = await this.shift(tx).where(eq(shiftRequests.id, id)).limit(1);
    return (row as ShiftRequestRow | undefined) ?? null;
  }

  /** What a person asked, newest first; and the swaps colleagues asked of them. */
  async shiftsOf(employeeId: string): Promise<{ mine: ShiftRequestRow[]; askedOfMe: ShiftRequestRow[] }> {
    const [mine, askedOfMe] = await Promise.all([
      this.shift().where(eq(shiftRequests.employeeId, employeeId)).orderBy(desc(shiftRequests.createdAt)).limit(100),
      this.shift()
        .where(and(eq(shiftRequests.swapEmployeeId, employeeId), eq(shiftRequests.status, 'awaiting_colleague')))
        .orderBy(desc(shiftRequests.createdAt)),
    ]);
    return { mine: mine as ShiftRequestRow[], askedOfMe: askedOfMe as ShiftRequestRow[] };
  }

  /** Requests routed to a manager's file, open ones first (058-self-service AC-SS15). */
  async shiftsRoutedTo(employeeId: string): Promise<ShiftRequestRow[]> {
    return (await this.shift()
      .where(eq(shiftRequests.routedToEmployeeId, employeeId))
      .orderBy(sql`${shiftRequests.status} in ('requested', 'awaiting_colleague') desc`, desc(shiftRequests.createdAt))
      .limit(200)) as ShiftRequestRow[];
  }

  async insertShift(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      kind: ShiftRequestKind;
      shiftTemplateId: string | null;
      swapEmployeeId: string | null;
      fromDate: string;
      toDate: string;
      reason: string;
      status: ShiftRequestStatus;
      routedToEmployeeId: string | null;
      requestedByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(shiftRequests).values(values).returning({ id: shiftRequests.id });
    return row.id;
  }

  /** Move a request from one of `from` to `to`, only while it is still there: of two racing moves, one wins. */
  async moveShift(
    tx: Tx,
    id: string,
    from: readonly ShiftRequestStatus[],
    to: ShiftRequestStatus,
    extra: { colleagueAcceptedAt?: Date; colleagueAcceptedByUserId?: string | null; decidedByUserId?: string; decisionNote?: string | null } = {},
  ): Promise<boolean> {
    const decided = to === 'approved' || to === 'rejected';
    const rows = await tx
      .update(shiftRequests)
      .set({
        status: to,
        ...(extra.colleagueAcceptedAt ? { colleagueAcceptedAt: extra.colleagueAcceptedAt } : {}),
        ...(extra.colleagueAcceptedByUserId !== undefined ? { colleagueAcceptedByUserId: extra.colleagueAcceptedByUserId } : {}),
        ...(decided ? { decidedAt: new Date(), decidedByUserId: extra.decidedByUserId ?? null, decisionNote: extra.decisionNote ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(shiftRequests.id, id), inArray(shiftRequests.status, [...from])))
      .returning({ id: shiftRequests.id });
    return rows.length > 0;
  }

  // --- Attendance requests --------------------------------------------------------------

  private readonly attendanceColumns = {
    id: attendanceRequests.id,
    orgId: attendanceRequests.orgId,
    employeeId: attendanceRequests.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    workDate: attendanceRequests.workDate,
    clockInAt: attendanceRequests.clockInAt,
    clockOutAt: attendanceRequests.clockOutAt,
    recordId: attendanceRequests.recordId,
    reason: attendanceRequests.reason,
    status: attendanceRequests.status,
    routedToEmployeeId: attendanceRequests.routedToEmployeeId,
    routedPreferredName: routedPerson.preferredName,
    routedLegalName: routedPerson.legalName,
    routedPositionTitle: routedPosition.title,
    decidedAt: attendanceRequests.decidedAt,
    decidedByName: decider.name,
    decisionNote: attendanceRequests.decisionNote,
    resultRecordId: attendanceRequests.resultRecordId,
    createdAt: attendanceRequests.createdAt,
    evidence: attendanceRequests.evidence,
    managerConfirmedAt: attendanceRequests.managerConfirmedAt,
    managerConfirmedByName: sql<string | null>`(select ${users.name} from ${users} where ${users.id} = ${attendanceRequests.managerConfirmedByUserId})`,
    recordClockInAt: sql<Date | string | null>`(select r.clock_in_at from attendance_records r where r.id = ${attendanceRequests.recordId})`,
    recordClockOutAt: sql<Date | string | null>`(select r.clock_out_at from attendance_records r where r.id = ${attendanceRequests.recordId})`,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private attendance(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.attendanceColumns)
      .from(attendanceRequests)
      .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(routedPerson, eq(routedPerson.id, attendanceRequests.routedToEmployeeId))
      .leftJoin(routedPosition, eq(routedPosition.id, routedPerson.jobPositionId))
      .leftJoin(decider, eq(decider.id, attendanceRequests.decidedByUserId));
  }

  private compiledAttendance(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): {
    where: SQL | undefined;
    own: SQL | undefined;
    compiled: ReturnType<typeof compileListQuery>;
  } {
    const compiled = compileListQuery({
      spec: ATTENDANCE_REQUEST_LIST,
      columns: {
        employee: personName,
        workDate: attendanceRequests.workDate,
        status: attendanceRequests.status,
        branch: employees.workPropertyId,
        routedToMe: routedToMe(sql`${attendanceRequests.routedToEmployeeId}`, input.me),
        createdAt: attendanceRequests.createdAt,
      },
      reader: 'basic',
      query: input.query,
      tieBreaker: attendanceRequests.id,
    });
    const own = and(eq(attendanceRequests.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  async attendancePage(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListRows<AttendanceRequestRow>> {
    const { compiled, own, where } = this.compiledAttendance(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.attendance().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(attendanceRequests)
        .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
        .where(where),
      this.db
        .select({ value: attendanceRequests.status, count: countAll })
        .from(attendanceRequests)
        .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(attendanceRequests.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(attendanceRequests)
            .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as AttendanceRequestRow[],
      total: Number(count),
      groups: groupsOf(ATTENDANCE_REQUEST_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async attendanceIds(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListIds> {
    const { compiled, where } = this.compiledAttendance(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: attendanceRequests.id })
        .from(attendanceRequests)
        .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.db
        .select({ count: countAll })
        .from(attendanceRequests)
        .innerJoin(employees, eq(employees.id, attendanceRequests.employeeId))
        .where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async findAttendance(id: string, tx?: Tx): Promise<AttendanceRequestRow | null> {
    const [row] = await this.attendance(tx).where(eq(attendanceRequests.id, id)).limit(1);
    return (row as AttendanceRequestRow | undefined) ?? null;
  }

  async attendanceOf(employeeId: string, from: string, to: string): Promise<AttendanceRequestRow[]> {
    return (await this.attendance()
      .where(
        and(
          eq(attendanceRequests.employeeId, employeeId),
          sql`${attendanceRequests.workDate} BETWEEN ${from} AND ${to}`,
        ),
      )
      .orderBy(desc(attendanceRequests.createdAt))) as AttendanceRequestRow[];
  }

  async attendanceRoutedTo(employeeId: string): Promise<AttendanceRequestRow[]> {
    return (await this.attendance()
      .where(eq(attendanceRequests.routedToEmployeeId, employeeId))
      .orderBy(sql`${attendanceRequests.status} = 'requested' desc`, desc(attendanceRequests.createdAt))
      .limit(200)) as AttendanceRequestRow[];
  }

  async insertAttendance(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      workDate: string;
      clockInAt: Date;
      clockOutAt: Date;
      recordId: string | null;
      reason: string;
      routedToEmployeeId: string | null;
      requestedByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(attendanceRequests).values(values).returning({ id: attendanceRequests.id });
    return row.id;
  }

  async moveAttendance(
    tx: Tx,
    id: string,
    to: AttendanceRequestStatus,
    extra: { decidedByUserId?: string; decisionNote?: string | null; resultRecordId?: string } = {},
  ): Promise<boolean> {
    const decided = to === 'approved' || to === 'rejected';
    const rows = await tx
      .update(attendanceRequests)
      .set({
        status: to,
        ...(decided ? { decidedAt: new Date(), decidedByUserId: extra.decidedByUserId ?? null, decisionNote: extra.decisionNote ?? null } : {}),
        ...(extra.resultRecordId ? { resultRecordId: extra.resultRecordId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(attendanceRequests.id, id), eq(attendanceRequests.status, 'requested')))
      .returning({ id: attendanceRequests.id });
    return rows.length > 0;
  }
}
