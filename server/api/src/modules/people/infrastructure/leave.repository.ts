import {
  LEAVE_REQUEST_LIST,
  MAX_BULK_IDS,
  type LeaveAccrual,
  type LeaveEndHalf,
  type LeaveEntryKind,
  type LeaveRequestStatus,
  type LeaveStartHalf,
  type ListIds,
  type ListQuery,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  employees,
  jobPositions,
  leaveLedgerEntries,
  leaveRequests,
  leaveTypes,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  compileListQuery,
  countAll,
  groupOrder,
  groupsOf,
  statusCountsOf,
  type CompiledList,
  type ListColumns,
  type ListRows,
} from '../../../shared/lists/list-query';
import type { LeaveDefaultsRule } from '../domain/hr-rules';
import type { Tx } from './employees.repository';
import { refLabels } from './hr-labels';

export interface LeaveTypeRow {
  id: string;
  orgId: string;
  code: string;
  name: string;
  paid: boolean;
  yearlyEntitlementDays: number | null;
  accrual: LeaveAccrual;
  needsApproval: boolean;
}

export interface LedgerRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  kind: LeaveEntryKind;
  days: number;
  effectiveOn: string;
  periodKey: string | null;
  leaveRequestId: string | null;
  reversesId: string | null;
  reason: string | null;
}

export interface LeaveRequestRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypePaid: boolean;
  startsOn: string;
  endsOn: string;
  startHalf: LeaveStartHalf;
  endHalf: LeaveEndHalf;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  routedToEmployeeId: string | null;
  routedToName: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

const routedTo = alias(employees, 'routed_to');

/**
 * Leave types, the append only ledger, and requests (ADR-058). The only place
 * that touches Drizzle for them.
 *
 * The ledger has insert paths and nothing else: no update, no delete. A
 * balance is a SUM over it, computed here and nowhere else.
 */
@Injectable()
export class LeaveRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Types ---------------------------------------------------------------

  private readonly typeColumns = {
    id: leaveTypes.id,
    orgId: leaveTypes.orgId,
    code: leaveTypes.code,
    name: leaveTypes.name,
    paid: leaveTypes.paid,
    yearlyEntitlementDays: leaveTypes.yearlyEntitlementDays,
    accrual: leaveTypes.accrual,
    needsApproval: leaveTypes.needsApproval,
  };

  async listTypes(orgId: string, tx?: Tx): Promise<LeaveTypeRow[]> {
    return (tx ?? this.db)
      .select(this.typeColumns)
      .from(leaveTypes)
      .where(and(eq(leaveTypes.orgId, orgId), eq(leaveTypes.status, 'active')))
      .orderBy(asc(leaveTypes.name));
  }

  async findType(id: string, tx?: Tx): Promise<LeaveTypeRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.typeColumns)
      .from(leaveTypes)
      .where(eq(leaveTypes.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Create a business's types from the defaults row, once (AC-L1).
   *
   * `ON CONFLICT (org_id, code) DO NOTHING`, so two first reads that race both
   * run this and the second inserts nothing: the unique pair decides, not the
   * read before it.
   */
  async createTypesFromDefaults(
    orgId: string,
    defaults: { configEntryId: string; value: LeaveDefaultsRule },
  ): Promise<void> {
    await this.db
      .insert(leaveTypes)
      .values(
        defaults.value.types.map((t) => ({
          orgId,
          code: t.code,
          name: t.name,
          paid: t.paid,
          yearlyEntitlementDays: t.yearlyEntitlementDays,
          accrual: t.accrual,
          carryForwardMaxDays: t.carryForwardMaxDays,
          needsApproval: t.needsApproval,
          configEntryId: defaults.configEntryId,
        })),
      )
      .onConflictDoNothing({ target: [leaveTypes.orgId, leaveTypes.code] });
  }

  /** Every business that has at least one active file, for the daily job. */
  async orgsWithStaff(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ orgId: employees.orgId })
      .from(employees)
      .where(eq(employees.status, 'active'));
    return rows.map((r) => r.orgId);
  }

  // --- Ledger --------------------------------------------------------------

  private readonly ledgerColumns = {
    id: leaveLedgerEntries.id,
    employeeId: leaveLedgerEntries.employeeId,
    leaveTypeId: leaveLedgerEntries.leaveTypeId,
    kind: leaveLedgerEntries.kind,
    days: leaveLedgerEntries.days,
    effectiveOn: leaveLedgerEntries.effectiveOn,
    periodKey: leaveLedgerEntries.periodKey,
    leaveRequestId: leaveLedgerEntries.leaveRequestId,
    reversesId: leaveLedgerEntries.reversesId,
    reason: leaveLedgerEntries.reason,
  };

  async ledger(employeeId: string, tx?: Tx): Promise<LedgerRow[]> {
    return (tx ?? this.db)
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .where(eq(leaveLedgerEntries.employeeId, employeeId))
      .orderBy(desc(leaveLedgerEntries.effectiveOn), desc(leaveLedgerEntries.createdAt));
  }

  /** The balance: the sum of the ledger, and nothing else (AC-L4). */
  async balance(employeeId: string, leaveTypeId: string, tx?: Tx): Promise<number> {
    const [row] = await (tx ?? this.db)
      .select({ total: sql<string | null>`sum(${leaveLedgerEntries.days})` })
      .from(leaveLedgerEntries)
      .where(
        and(
          eq(leaveLedgerEntries.employeeId, employeeId),
          eq(leaveLedgerEntries.leaveTypeId, leaveTypeId),
        ),
      );
    return Number(row?.total ?? 0);
  }

  /** Days asked for and not yet decided, which a new request must leave room for. */
  async pendingDays(
    employeeId: string,
    leaveTypeId: string,
    exceptRequestId: string | null,
    tx?: Tx,
  ): Promise<number> {
    const where = [
      eq(leaveRequests.employeeId, employeeId),
      eq(leaveRequests.leaveTypeId, leaveTypeId),
      eq(leaveRequests.status, 'requested'),
    ];
    if (exceptRequestId) where.push(ne(leaveRequests.id, exceptRequestId));
    const [row] = await (tx ?? this.db)
      .select({ total: sql<string | null>`sum(${leaveRequests.days})` })
      .from(leaveRequests)
      .where(and(...where));
    return Number(row?.total ?? 0);
  }

  /**
   * Write accruals the job owes. The partial unique index on `(employee, type,
   * kind, period_key)` drops every period already written, so this is safe to
   * run as often as anyone likes (AC-L2). Returns how many rows were new.
   */
  async insertAccruals(
    rows: {
      orgId: string;
      employeeId: string;
      leaveTypeId: string;
      days: number;
      effectiveOn: string;
      periodKey: string;
    }[],
    tx?: Tx,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted = await (tx ?? this.db)
      .insert(leaveLedgerEntries)
      .values(rows.map((r) => ({ ...r, kind: 'accrual' as const, createdByUserId: null })))
      .onConflictDoNothing({
        target: [
          leaveLedgerEntries.employeeId,
          leaveLedgerEntries.leaveTypeId,
          leaveLedgerEntries.kind,
          leaveLedgerEntries.periodKey,
        ],
        where: sql`${leaveLedgerEntries.kind} IN ('accrual', 'carry_forward', 'expiry')`,
      })
      .returning({ id: leaveLedgerEntries.id });
    return inserted.length;
  }

  async insertLedger(
    tx: Tx,
    rows: {
      orgId: string;
      employeeId: string;
      leaveTypeId: string;
      kind: 'taken' | 'reversal';
      days: number;
      effectiveOn: string;
      leaveRequestId: string;
      reversesId: string | null;
      reason: string | null;
      createdByUserId: string;
    }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await tx.insert(leaveLedgerEntries).values(rows);
  }

  /** The `taken` rows of one request not yet reversed. */
  async unreversedTaken(requestId: string, tx: Tx): Promise<LedgerRow[]> {
    const reversal = alias(leaveLedgerEntries, 'reversal');
    return tx
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .leftJoin(reversal, eq(reversal.reversesId, leaveLedgerEntries.id))
      .where(
        and(
          eq(leaveLedgerEntries.leaveRequestId, requestId),
          eq(leaveLedgerEntries.kind, 'taken'),
          sql`${reversal.id} IS NULL`,
        ),
      )
      .orderBy(asc(leaveLedgerEntries.effectiveOn));
  }

  // --- Requests ------------------------------------------------------------

  private readonly requestColumns = {
    id: leaveRequests.id,
    orgId: leaveRequests.orgId,
    employeeId: leaveRequests.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    leaveTypeId: leaveRequests.leaveTypeId,
    leaveTypeCode: leaveTypes.code,
    leaveTypeName: leaveTypes.name,
    leaveTypePaid: leaveTypes.paid,
    startsOn: leaveRequests.startsOn,
    endsOn: leaveRequests.endsOn,
    startHalf: leaveRequests.startHalf,
    endHalf: leaveRequests.endHalf,
    days: leaveRequests.days,
    reason: leaveRequests.reason,
    status: leaveRequests.status,
    routedToEmployeeId: leaveRequests.routedToEmployeeId,
    routedToName: sql<string | null>`coalesce(${routedTo.preferredName}, ${routedTo.legalName})`,
    decidedAt: leaveRequests.decidedAt,
    decisionNote: leaveRequests.decisionNote,
    createdAt: leaveRequests.createdAt,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private requests(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.requestColumns)
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(routedTo, eq(routedTo.id, leaveRequests.routedToEmployeeId));
  }

  /**
   * The leave list's field to column map (`LEAVE_REQUEST_LIST`). `routedToMe`
   * depends on who asks, so the map is built per caller: `me` is their own
   * file at this business, or null when they hold none.
   */
  private listColumns(me: string | null): ListColumns {
    return {
      status: leaveRequests.status,
      leaveType: leaveRequests.leaveTypeId,
      employee: sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`,
      startsOn: leaveRequests.startsOn,
      endsOn: leaveRequests.endsOn,
      days: leaveRequests.days,
      branch: employees.workPropertyId,
      routedToMe: me
        ? sql`coalesce(${leaveRequests.routedToEmployeeId} = ${me}::uuid, false)`
        : sql`false`,
      createdAt: leaveRequests.createdAt,
    };
  }

  private compiledList(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): {
    compiled: CompiledList;
    own: SQL | undefined;
    where: SQL | undefined;
  } {
    const compiled = compileListQuery({
      spec: LEAVE_REQUEST_LIST,
      columns: this.listColumns(input.me),
      reader: 'basic',
      query: input.query,
      tieBreaker: leaveRequests.id,
    });
    const own = and(eq(leaveRequests.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  /**
   * The queue: one page of requests of people in the caller's branches
   * (AC-L4, AC-LF3). By default the ones routed to the caller come first, then
   * by first day, as the queue always read.
   */
  async listRequestsPage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
    me: string | null;
  }): Promise<ListRows<LeaveRequestRow>> {
    const { compiled, own, where } = this.compiledList(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.requests().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(where),
      this.db
        .select({ value: leaveRequests.status, count: countAll })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(leaveRequests.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(leaveRequests)
            .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as LeaveRequestRow[],
      total: Number(count),
      groups: groupsOf(LEAVE_REQUEST_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  /** Select all over the queue (AC-LF15): the matching ids up to the bulk cap, and how many match. */
  async listRequestIds(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListIds> {
    const { compiled, where } = this.compiledList(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: leaveRequests.id })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.db
        .select({ count: countAll })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async requestsOf(employeeId: string, tx?: Tx): Promise<LeaveRequestRow[]> {
    return (await this.requests(tx)
      .where(eq(leaveRequests.employeeId, employeeId))
      .orderBy(desc(leaveRequests.startsOn))) as LeaveRequestRow[];
  }

  async findRequest(id: string, tx?: Tx): Promise<LeaveRequestRow | null> {
    const [row] = await this.requests(tx).where(eq(leaveRequests.id, id)).limit(1);
    return (row as LeaveRequestRow | undefined) ?? null;
  }

  /** Throws 23P01 on `leave_requests_no_overlap` when it overlaps an open one. */
  async insertRequest(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      leaveTypeId: string;
      startsOn: string;
      endsOn: string;
      startHalf: LeaveStartHalf;
      endHalf: LeaveEndHalf;
      days: number;
      reason: string | null;
      routedToEmployeeId: string | null;
      requestedByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(leaveRequests).values(values).returning({ id: leaveRequests.id });
    return row.id;
  }

  /**
   * Move a request from `from` to `to`, only while it is still `from`. Of two
   * racing decisions, the second finds nothing to move and gets false (AC-L5).
   */
  async decide(
    tx: Tx,
    input: {
      id: string;
      from: LeaveRequestStatus;
      to: LeaveRequestStatus;
      userId: string;
      note: string | null;
      days?: number;
    },
  ): Promise<boolean> {
    const rows = await tx
      .update(leaveRequests)
      .set({
        status: input.to,
        decidedByUserId: input.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
        ...(input.days !== undefined ? { days: input.days } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.status, input.from)))
      .returning({ id: leaveRequests.id });
    return rows.length > 0;
  }

  /** An approved leave of this person covering `date`, if any (AC-T3, AC-T4). */
  async approvedOn(employeeId: string, date: string, tx?: Tx): Promise<LeaveRequestRow | null> {
    const [row] = await this.requests(tx)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startsOn, date),
          gte(leaveRequests.endsOn, date),
        ),
      )
      .limit(1);
    return (row as LeaveRequestRow | undefined) ?? null;
  }

  /** Open requests (requested or approved) of a person ending after `date`. */
  async openEndingAfter(employeeId: string, date: string, tx: Tx): Promise<LeaveRequestRow[]> {
    return (await this.requests(tx).where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        inArray(leaveRequests.status, ['requested', 'approved']),
        sql`${leaveRequests.endsOn} > ${date}`,
      ),
    )) as LeaveRequestRow[];
  }

  /**
   * Unpaid leave taken in a month, for pay: the `taken` and `reversal` rows of
   * types with `paid = false`, dated in the month (AC-Y1).
   */
  async unpaidInMonth(
    orgId: string,
    first: string,
    last: string,
    tx?: Tx,
  ): Promise<{ employeeId: string; days: number; effectiveOn: string }[]> {
    return (tx ?? this.db)
      .select({
        employeeId: leaveLedgerEntries.employeeId,
        days: leaveLedgerEntries.days,
        effectiveOn: leaveLedgerEntries.effectiveOn,
      })
      .from(leaveLedgerEntries)
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveLedgerEntries.leaveTypeId))
      .where(
        and(
          eq(leaveLedgerEntries.orgId, orgId),
          eq(leaveTypes.paid, false),
          inArray(leaveLedgerEntries.kind, ['taken', 'reversal']),
          gte(leaveLedgerEntries.effectiveOn, first),
          lte(leaveLedgerEntries.effectiveOn, last),
        ),
      );
  }
}
