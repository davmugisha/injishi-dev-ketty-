import {
  LEAVE_BALANCE_LIST,
  LEAVE_REQUEST_LIST,
  MAX_BULK_IDS,
  type HrSex,
  type LeaveAccrual,
  type LeaveCarry,
  type LeaveEndHalf,
  type LeaveEntryKind,
  type LeavePayment,
  type LeaveRequestStatus,
  type LeaveReset,
  type LeaveStartHalf,
  type LeaveTypeStatus,
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
  leaveRequestApprovals,
  leaveRequests,
  leaveTypes,
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
  type CompiledList,
  type ListColumns,
  type ListRows,
} from '../../../shared/lists/list-query';
import type { LeaveDefaultType } from '../domain/hr-rules';
import type { LedgerItem, PlannedRow } from '../domain/leave-lots';
import type { Tx } from './employees.repository';
import { refLabels } from './hr-labels';

/** Every rule of a type (058-leave AC-LV1), as stored. */
export interface LeaveTypeRules {
  name: string;
  payment: LeavePayment;
  paymentPercent: number | null;
  yearlyEntitlementDays: number | null;
  accrual: LeaveAccrual;
  reset: LeaveReset;
  carry: LeaveCarry;
  carryMaxDays: number;
  carryExpiresMonths: number | null;
  approvalSteps: number;
  needsAttachment: boolean;
  countsWeeklyOffs: boolean;
  countsHolidays: boolean;
  eligibleSex: HrSex | null;
  minServiceMonths: number;
  oncePerEmployment: boolean;
  statutory: boolean;
  allowsPastRequests: boolean;
  encashable: boolean;
  compensatory: boolean;
  seniorityEveryYears: number | null;
  seniorityExtraDays: number | null;
  seniorityCapDays: number | null;
}

export interface LeaveTypeRow extends LeaveTypeRules {
  id: string;
  orgId: string;
  code: string;
  status: LeaveTypeStatus;
}

export interface LedgerRow extends LedgerItem {
  employeeId: string;
  leaveTypeId: string;
  leaveRequestId: string | null;
  reason: string | null;
  allocationRequestId: string | null;
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
  payment: LeavePayment;
  paymentPercent: number | null;
  approvalSteps: number;
  currentStep: number;
  attachmentKey: string | null;
}

export interface ApprovalRow {
  requestId: string;
  step: number;
  decision: 'approved' | 'rejected' | 'skipped';
  decidedByUserId: string | null;
  decidedByName: string | null;
  note: string | null;
  decidedAt: Date;
}

/** A row of the ledger as a write gives it; ids and dates are the database's. */
export interface LedgerInsert {
  orgId: string;
  employeeId: string;
  leaveTypeId: string;
  kind: LeaveEntryKind;
  days: number;
  effectiveOn: string;
  leaveRequestId?: string | null;
  reversesId?: string | null;
  lotId?: string | null;
  expiresOn?: string | null;
  allocationRequestId?: string | null;
  reason?: string | null;
  createdByUserId: string | null;
}

const routedTo = alias(employees, 'routed_to');
const decider = alias(users, 'decider');
const personName = sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;

const typeColumns = {
  id: leaveTypes.id,
  orgId: leaveTypes.orgId,
  code: leaveTypes.code,
  name: leaveTypes.name,
  status: leaveTypes.status,
  payment: leaveTypes.payment,
  paymentPercent: leaveTypes.paymentPercent,
  yearlyEntitlementDays: leaveTypes.yearlyEntitlementDays,
  accrual: leaveTypes.accrual,
  reset: leaveTypes.reset,
  carry: leaveTypes.carry,
  carryMaxDays: leaveTypes.carryMaxDays,
  carryExpiresMonths: leaveTypes.carryExpiresMonths,
  approvalSteps: leaveTypes.approvalSteps,
  needsAttachment: leaveTypes.needsAttachment,
  countsWeeklyOffs: leaveTypes.countsWeeklyOffs,
  countsHolidays: leaveTypes.countsHolidays,
  eligibleSex: leaveTypes.eligibleSex,
  minServiceMonths: leaveTypes.minServiceMonths,
  oncePerEmployment: leaveTypes.oncePerEmployment,
  statutory: leaveTypes.statutory,
  allowsPastRequests: leaveTypes.allowsPastRequests,
  encashable: leaveTypes.encashable,
  compensatory: leaveTypes.compensatory,
  seniorityEveryYears: leaveTypes.seniorityEveryYears,
  seniorityExtraDays: leaveTypes.seniorityExtraDays,
  seniorityCapDays: leaveTypes.seniorityCapDays,
};

/** A default type's rules as the table takes them. */
export function rulesOf(t: LeaveDefaultType): LeaveTypeRules {
  return {
    name: t.name,
    payment: t.payment,
    paymentPercent: t.paymentPercent,
    yearlyEntitlementDays: t.yearlyEntitlementDays,
    accrual: t.accrual,
    reset: t.reset,
    carry: t.carry,
    carryMaxDays: t.carryMaxDays,
    carryExpiresMonths: t.carryExpiresMonths,
    approvalSteps: t.approvalSteps,
    needsAttachment: t.needsAttachment,
    countsWeeklyOffs: t.countsWeeklyOffs,
    countsHolidays: t.countsHolidays,
    eligibleSex: t.eligibleSex,
    minServiceMonths: t.minServiceMonths,
    oncePerEmployment: t.oncePerEmployment,
    statutory: t.statutory,
    allowsPastRequests: t.allowsPastRequests,
    encashable: t.encashable,
    compensatory: t.compensatory,
    seniorityEveryYears: t.seniorityEveryYears,
    seniorityExtraDays: t.seniorityExtraDays,
    seniorityCapDays: t.seniorityCapDays,
  };
}

/**
 * Leave types, the append only ledger, requests and their decisions (ADR-058,
 * 058-leave). The only place that touches Drizzle for them.
 *
 * The ledger has insert paths and nothing else: no update, no delete. A
 * balance is a SUM over it; what is left of each lot is worked out in
 * `domain/leave-lots.ts` from the rows read here.
 */
@Injectable()
export class LeaveRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Types ---------------------------------------------------------------

  /** The active types; every type, archived ones too, for the types screen. */
  async listTypes(orgId: string, tx?: Tx, includeArchived = false): Promise<LeaveTypeRow[]> {
    const where = [eq(leaveTypes.orgId, orgId)];
    if (!includeArchived) where.push(eq(leaveTypes.status, 'active'));
    return (tx ?? this.db)
      .select(typeColumns)
      .from(leaveTypes)
      .where(and(...where))
      .orderBy(asc(leaveTypes.name));
  }

  async findType(id: string, tx?: Tx): Promise<LeaveTypeRow | null> {
    const [row] = await (tx ?? this.db).select(typeColumns).from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * Create a business's types from the defaults row, once (AC-L1).
   * `ON CONFLICT (org_id, code) DO NOTHING`, so two first reads that race both
   * run this and the second inserts nothing.
   */
  async createTypesFromDefaults(orgId: string, defaults: { configEntryId: string; value: { types: LeaveDefaultType[] } }): Promise<void> {
    await this.db
      .insert(leaveTypes)
      .values(defaults.value.types.map((t) => ({ orgId, code: t.code, configEntryId: defaults.configEntryId, ...rulesOf(t) })))
      .onConflictDoNothing({ target: [leaveTypes.orgId, leaveTypes.code] });
  }

  /** Insert one type; throws 23505 on `leave_types_code_uk`. */
  async insertType(tx: Tx, values: LeaveTypeRules & { orgId: string; code: string; configEntryId?: string | null }): Promise<string> {
    const [row] = await tx.insert(leaveTypes).values(values).returning({ id: leaveTypes.id });
    return row.id;
  }

  async updateType(
    tx: Tx,
    id: string,
    values: Partial<LeaveTypeRules> & { status?: LeaveTypeStatus; configEntryId?: string | null },
  ): Promise<void> {
    await tx.update(leaveTypes).set({ ...values, updatedAt: new Date() }).where(eq(leaveTypes.id, id));
  }

  /** Whether any request or ledger row names the type: what makes keeping a balance a fixed choice. */
  async typeInUse(id: string, tx?: Tx): Promise<boolean> {
    const db = tx ?? this.db;
    const [ledger] = await db.select({ id: leaveLedgerEntries.id }).from(leaveLedgerEntries).where(eq(leaveLedgerEntries.leaveTypeId, id)).limit(1);
    if (ledger) return true;
    const [request] = await db.select({ id: leaveRequests.id }).from(leaveRequests).where(eq(leaveRequests.leaveTypeId, id)).limit(1);
    return request !== undefined;
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
    lotId: leaveLedgerEntries.lotId,
    expiresOn: leaveLedgerEntries.expiresOn,
    allocationRequestId: leaveLedgerEntries.allocationRequestId,
  };

  async ledger(employeeId: string, tx?: Tx): Promise<LedgerRow[]> {
    return (tx ?? this.db)
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .where(eq(leaveLedgerEntries.employeeId, employeeId))
      .orderBy(desc(leaveLedgerEntries.effectiveOn), desc(leaveLedgerEntries.createdAt));
  }

  /** One person's rows of one type, oldest first: what lots are worked out from. */
  async ledgerOf(employeeId: string, leaveTypeId: string, tx?: Tx): Promise<LedgerRow[]> {
    return (tx ?? this.db)
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .where(and(eq(leaveLedgerEntries.employeeId, employeeId), eq(leaveLedgerEntries.leaveTypeId, leaveTypeId)))
      .orderBy(asc(leaveLedgerEntries.effectiveOn), asc(leaveLedgerEntries.createdAt));
  }

  /** Every row of these people, for the balances list. */
  async ledgerOfMany(employeeIds: readonly string[]): Promise<LedgerRow[]> {
    if (employeeIds.length === 0) return [];
    return this.db
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .where(inArray(leaveLedgerEntries.employeeId, [...employeeIds]));
  }

  /** The balance: the sum of the ledger, and nothing else (AC-L4). */
  async balance(employeeId: string, leaveTypeId: string, tx?: Tx): Promise<number> {
    const [row] = await (tx ?? this.db)
      .select({ total: sql<string | null>`sum(${leaveLedgerEntries.days})` })
      .from(leaveLedgerEntries)
      .where(and(eq(leaveLedgerEntries.employeeId, employeeId), eq(leaveLedgerEntries.leaveTypeId, leaveTypeId)));
    return Number(row?.total ?? 0);
  }

  /** Days asked for and not yet decided, which a new request must leave room for. */
  async pendingDays(employeeId: string, leaveTypeId: string, exceptRequestId: string | null, tx?: Tx): Promise<number> {
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
    rows: { orgId: string; employeeId: string; leaveTypeId: string; days: number; effectiveOn: string; periodKey: string }[],
    tx?: Tx,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted = await (tx ?? this.db)
      .insert(leaveLedgerEntries)
      .values(rows.map((r) => ({ ...r, kind: 'accrual' as const, createdByUserId: null })))
      .onConflictDoNothing({
        target: [leaveLedgerEntries.employeeId, leaveLedgerEntries.leaveTypeId, leaveLedgerEntries.kind, leaveLedgerEntries.periodKey],
        where: sql`${leaveLedgerEntries.kind} IN ('accrual', 'carry_forward')`,
      })
      .returning({ id: leaveLedgerEntries.id });
    return inserted.length;
  }

  /**
   * Write what the lot planner says is due (AC-LV2, AC-LV3), in its order: a
   * carried lot, then any expiry naming it. Each is guarded by its own unique
   * index, one carry per year and one expiry per lot, so a race or a rerun
   * writes nothing twice. Returns how many rows were new.
   */
  async insertPlanned(tx: Tx, base: { orgId: string; employeeId: string; leaveTypeId: string }, rows: readonly PlannedRow[]): Promise<number> {
    const ids = new Map<string, string>();
    let written = 0;
    for (const row of rows) {
      if (row.kind === 'carry_forward') {
        const [inserted] = await tx
          .insert(leaveLedgerEntries)
          .values({
            ...base,
            kind: 'carry_forward',
            days: row.days,
            effectiveOn: row.effectiveOn,
            periodKey: row.periodKey,
            expiresOn: row.expiresOn,
            reason: 'Carried into the new year',
            createdByUserId: null,
          })
          .onConflictDoNothing({
            target: [leaveLedgerEntries.employeeId, leaveLedgerEntries.leaveTypeId, leaveLedgerEntries.kind, leaveLedgerEntries.periodKey],
            where: sql`${leaveLedgerEntries.kind} IN ('accrual', 'carry_forward')`,
          })
          .returning({ id: leaveLedgerEntries.id });
        if (inserted) {
          ids.set(row.ref, inserted.id);
          written += 1;
        }
        continue;
      }
      const lotId = row.lotId ?? (row.lotRef ? ids.get(row.lotRef) : undefined);
      if (!lotId) continue;
      const inserted = await tx
        .insert(leaveLedgerEntries)
        .values({
          ...base,
          kind: 'expiry',
          days: row.days,
          effectiveOn: row.effectiveOn,
          lotId,
          reason: 'Expired',
          createdByUserId: null,
        })
        .onConflictDoNothing({ target: leaveLedgerEntries.lotId, where: sql`${leaveLedgerEntries.kind} = 'expiry'` })
        .returning({ id: leaveLedgerEntries.id });
      written += inserted.length;
    }
    return written;
  }

  /** Insert rows and answer their ids, in order. */
  async insertLedger(tx: Tx, rows: readonly LedgerInsert[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const inserted = await tx.insert(leaveLedgerEntries).values([...rows]).returning({ id: leaveLedgerEntries.id });
    return inserted.map((r) => r.id);
  }

  /** The `taken` rows of one request not yet reversed. */
  async unreversedTaken(requestId: string, tx: Tx): Promise<LedgerRow[]> {
    const reversal = alias(leaveLedgerEntries, 'reversal');
    return tx
      .select(this.ledgerColumns)
      .from(leaveLedgerEntries)
      .leftJoin(reversal, eq(reversal.reversesId, leaveLedgerEntries.id))
      .where(and(eq(leaveLedgerEntries.leaveRequestId, requestId), eq(leaveLedgerEntries.kind, 'taken'), sql`${reversal.id} IS NULL`))
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
    payment: leaveRequests.payment,
    paymentPercent: leaveRequests.paymentPercent,
    approvalSteps: leaveRequests.approvalSteps,
    currentStep: leaveRequests.currentStep,
    attachmentKey: leaveRequests.attachmentKey,
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
   * depends on who asks, so the map is built per caller.
   */
  private listColumns(me: string | null): ListColumns {
    return {
      status: leaveRequests.status,
      leaveType: leaveRequests.leaveTypeId,
      employee: personName,
      startsOn: leaveRequests.startsOn,
      endsOn: leaveRequests.endsOn,
      days: leaveRequests.days,
      branch: employees.workPropertyId,
      // Always the comparison, even for a caller with no file: Postgres refuses a constant in ORDER BY.
      routedToMe: sql`coalesce(${leaveRequests.routedToEmployeeId} = ${me}::uuid, false)`,
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

  async listRequestsPage(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListRows<LeaveRequestRow>> {
    const { compiled, own, where } = this.compiledList(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.requests().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db.select({ count: countAll }).from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId)).where(where),
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
      this.db.select({ count: countAll }).from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId)).where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async requestsOf(employeeId: string, tx?: Tx): Promise<LeaveRequestRow[]> {
    return (await this.requests(tx).where(eq(leaveRequests.employeeId, employeeId)).orderBy(desc(leaveRequests.startsOn))) as LeaveRequestRow[];
  }

  /** Requests routed to a manager's file, open ones first (058-self-service AC-SS15). */
  async requestsRoutedTo(employeeId: string): Promise<LeaveRequestRow[]> {
    return (await this.requests()
      .where(eq(leaveRequests.routedToEmployeeId, employeeId))
      .orderBy(sql`${leaveRequests.status} = 'requested' desc`, desc(leaveRequests.createdAt))
      .limit(200)) as LeaveRequestRow[];
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
      payment: LeavePayment;
      paymentPercent: number | null;
      approvalSteps: number;
      attachmentKey: string | null;
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
    input: { id: string; from: LeaveRequestStatus; to: LeaveRequestStatus; userId: string | null; note: string | null; days?: number },
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

  /** Step 1 decided, step 2 next: only while the request still waits at step 1 (AC-LV7). */
  async advanceStep(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(leaveRequests)
      .set({ currentStep: 2, updatedAt: new Date() })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'requested'), eq(leaveRequests.currentStep, 1)))
      .returning({ id: leaveRequests.id });
    return rows.length > 0;
  }

  /** One step's decision; the unique (request, step) refuses a second (AC-LV7). */
  async insertApproval(
    tx: Tx,
    values: { orgId: string; requestId: string; step: number; decision: 'approved' | 'rejected' | 'skipped'; decidedByUserId: string | null; note: string | null },
  ): Promise<void> {
    await tx.insert(leaveRequestApprovals).values(values);
  }

  async approvalsOf(requestIds: readonly string[], tx?: Tx): Promise<ApprovalRow[]> {
    if (requestIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        requestId: leaveRequestApprovals.requestId,
        step: leaveRequestApprovals.step,
        decision: leaveRequestApprovals.decision,
        decidedByUserId: leaveRequestApprovals.decidedByUserId,
        decidedByName: decider.name,
        note: leaveRequestApprovals.note,
        decidedAt: leaveRequestApprovals.decidedAt,
      })
      .from(leaveRequestApprovals)
      .leftJoin(decider, eq(decider.id, leaveRequestApprovals.decidedByUserId))
      .where(inArray(leaveRequestApprovals.requestId, [...requestIds]))
      .orderBy(asc(leaveRequestApprovals.step));
  }

  /** Has this person had an approved leave of this type on this file (AC-LV6, once per employment)? */
  async takenBefore(employeeId: string, leaveTypeId: string, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.leaveTypeId, leaveTypeId), eq(leaveRequests.status, 'approved')))
      .limit(1);
    return !!row;
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

  /** A person's approved leave overlapping a window, for the rotation generator (058-time AC-TM3). */
  async approvedBetween(employeeId: string, from: string, to: string, tx?: Tx): Promise<{ startsOn: string; endsOn: string }[]> {
    return (tx ?? this.db)
      .select({ startsOn: leaveRequests.startsOn, endsOn: leaveRequests.endsOn })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startsOn, to),
          gte(leaveRequests.endsOn, from),
        ),
      );
  }

  /** Open requests (requested or approved) of a person ending after `date`. */
  async openEndingAfter(employeeId: string, date: string, tx: Tx): Promise<LeaveRequestRow[]> {
    return (await this.requests(tx).where(
      and(eq(leaveRequests.employeeId, employeeId), inArray(leaveRequests.status, ['requested', 'approved']), sql`${leaveRequests.endsOn} > ${date}`),
    )) as LeaveRequestRow[];
  }

  /** Approved leave in a business's branches overlapping a window: the dashboard (AC-LV13). */
  async approvedOverlapping(orgId: string, scope: BranchScope, from: string, to: string): Promise<LeaveRequestRow[]> {
    return (await this.requests()
      .where(
        and(
          eq(leaveRequests.orgId, orgId),
          inBranchScope(employees.workPropertyId, scope),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startsOn, to),
          gte(leaveRequests.endsOn, from),
        ),
      )
      .orderBy(asc(leaveRequests.startsOn), asc(personName))) as LeaveRequestRow[];
  }

  /** How many requests wait, how many on the caller and how many at step 2 (AC-LV13). */
  async waitingCounts(orgId: string, scope: BranchScope, me: string | null): Promise<{ requests: number; routedToMe: number; atStepTwo: number }> {
    const [row] = await this.db
      .select({
        requests: countAll,
        routedToMe: sql<number>`count(*) filter (where ${leaveRequests.routedToEmployeeId} = ${me}::uuid)::int`,
        atStepTwo: sql<number>`count(*) filter (where ${leaveRequests.currentStep} = 2)::int`,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(and(eq(leaveRequests.orgId, orgId), inBranchScope(employees.workPropertyId, scope), eq(leaveRequests.status, 'requested')));
    return { requests: Number(row?.requests ?? 0), routedToMe: Number(row?.routedToMe ?? 0), atStepTwo: Number(row?.atStepTwo ?? 0) };
  }

  // --- Everybody's balances (AC-LV13) ---------------------------------------------

  private balanceColumns(): ListColumns {
    return { employee: personName, branch: employees.workPropertyId, jobPosition: employees.jobPositionId };
  }

  /** One page of the active people in the caller's branches, for the balances list. */
  async balancePeoplePage(input: {
    orgId: string;
    scope: BranchScope;
    query: ListQuery;
  }): Promise<ListRows<{ id: string; preferredName: string | null; legalName: string; jobPositionId: string | null; jobPositionTitle: string | null; workPropertyId: string | null; hiredOn: string; status: 'active' | 'offboarded'; offboardedOn: string | null; orgId: string }>> {
    const compiled = compileListQuery({ spec: LEAVE_BALANCE_LIST, columns: this.balanceColumns(), reader: 'basic', query: input.query, tieBreaker: employees.id });
    const own = and(eq(employees.orgId, input.orgId), eq(employees.status, 'active'), inBranchScope(employees.workPropertyId, input.scope));
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], groupRows] = await Promise.all([
      this.db
        .select({
          id: employees.id,
          orgId: employees.orgId,
          preferredName: employees.preferredName,
          legalName: employees.legalName,
          jobPositionId: employees.jobPositionId,
          jobPositionTitle: jobPositions.title,
          workPropertyId: employees.workPropertyId,
          hiredOn: employees.hiredOn,
          status: employees.status,
          offboardedOn: employees.offboardedOn,
        })
        .from(employees)
        .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(compiled.limit)
        .offset(compiled.offset),
      this.db.select({ count: countAll }).from(employees).where(where),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(employees)
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows,
      total: Number(count),
      groups: groupsOf(LEAVE_BALANCE_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: [],
    };
  }

  // --- Pay (058-payroll reads this) -----------------------------------------------

  /**
   * Leave not fully paid in a month (AC-Y1, 058-leave AC-LV1): the `taken` and
   * `reversal` rows of requests whose terms are unpaid or partly paid, dated in
   * the month, each with the share of the day pay does NOT cover (100 for
   * unpaid, 100 less the percentage for partial). A request carries its terms
   * from when it was made, so editing a type never reprices leave taken.
   */
  async unpaidInMonth(
    orgId: string,
    first: string,
    last: string,
    tx?: Tx,
  ): Promise<{ employeeId: string; days: number; effectiveOn: string; unpaidPercent: number }[]> {
    const rows = await (tx ?? this.db)
      .select({
        employeeId: leaveLedgerEntries.employeeId,
        days: leaveLedgerEntries.days,
        effectiveOn: leaveLedgerEntries.effectiveOn,
        payment: leaveRequests.payment,
        paymentPercent: leaveRequests.paymentPercent,
      })
      .from(leaveLedgerEntries)
      .innerJoin(leaveRequests, eq(leaveRequests.id, leaveLedgerEntries.leaveRequestId))
      .where(
        and(
          eq(leaveLedgerEntries.orgId, orgId),
          inArray(leaveRequests.payment, ['unpaid', 'partial']),
          inArray(leaveLedgerEntries.kind, ['taken', 'reversal']),
          gte(leaveLedgerEntries.effectiveOn, first),
          lte(leaveLedgerEntries.effectiveOn, last),
        ),
      );
    return rows.map((r) => ({
      employeeId: r.employeeId,
      days: r.days,
      effectiveOn: r.effectiveOn,
      unpaidPercent: r.payment === 'unpaid' ? 100 : 100 - (r.paymentPercent ?? 0),
    }));
  }
}
