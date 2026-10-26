import {
  LEAVE_ALLOCATION_LIST,
  MAX_BULK_IDS,
  type LeaveAllocationKind,
  type LeaveAllocationStatus,
  type ListIds,
  type ListQuery,
  type OrgRole,
  type RestrictedTypeMode,
  type RolePermissionOverride,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  departmentMembers,
  departments,
  employees,
  jobPositions,
  leaveAllocationRequests,
  leaveTypes,
  orgMembershipBranches,
  orgMemberships,
  orgRolePermissions,
  restrictedLeavePeriods,
  restrictedLeaveScopes,
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
  type ListRows,
} from '../../../shared/lists/list-query';
import type { RestrictionRule } from '../domain/leave-lots';
import type { Tx } from './employees.repository';
import { refLabels } from './hr-labels';

const routedPerson = alias(employees, 'routed_person');
const routedPosition = alias(jobPositions, 'routed_position');
const decider = alias(users, 'decider');
const personName = sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;

export interface AllocationRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  kind: LeaveAllocationKind;
  days: number;
  attendanceRecordId: string | null;
  workDate: string | null;
  reason: string;
  status: LeaveAllocationStatus;
  routedToEmployeeId: string | null;
  routedPreferredName: string | null;
  routedLegalName: string | null;
  routedPositionTitle: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: Date;
}

export interface PeriodRow extends RestrictionRule {
  orgId: string;
  departmentName: string | null;
  description: string | null;
}

/**
 * The rest of leave (ADR-058, 058-leave): requests for extra and compensatory
 * days, restricted periods, and who besides a step 1 decider could decide at a
 * branch. The only place that touches Drizzle for them.
 */
@Injectable()
export class LeaveExtraRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Allocation requests (AC-LV8) -------------------------------------------------

  private readonly allocationColumns = {
    id: leaveAllocationRequests.id,
    orgId: leaveAllocationRequests.orgId,
    employeeId: leaveAllocationRequests.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    leaveTypeId: leaveAllocationRequests.leaveTypeId,
    leaveTypeName: leaveTypes.name,
    kind: leaveAllocationRequests.kind,
    days: leaveAllocationRequests.days,
    attendanceRecordId: leaveAllocationRequests.attendanceRecordId,
    workDate: leaveAllocationRequests.workDate,
    reason: leaveAllocationRequests.reason,
    status: leaveAllocationRequests.status,
    routedToEmployeeId: leaveAllocationRequests.routedToEmployeeId,
    routedPreferredName: routedPerson.preferredName,
    routedLegalName: routedPerson.legalName,
    routedPositionTitle: routedPosition.title,
    decidedAt: leaveAllocationRequests.decidedAt,
    decidedByName: decider.name,
    decisionNote: leaveAllocationRequests.decisionNote,
    createdAt: leaveAllocationRequests.createdAt,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private allocations(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.allocationColumns)
      .from(leaveAllocationRequests)
      .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveAllocationRequests.leaveTypeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(routedPerson, eq(routedPerson.id, leaveAllocationRequests.routedToEmployeeId))
      .leftJoin(routedPosition, eq(routedPosition.id, routedPerson.jobPositionId))
      .leftJoin(decider, eq(decider.id, leaveAllocationRequests.decidedByUserId));
  }

  private compiled(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): {
    where: SQL | undefined;
    own: SQL | undefined;
    compiled: ReturnType<typeof compileListQuery>;
  } {
    const compiled = compileListQuery({
      spec: LEAVE_ALLOCATION_LIST,
      columns: {
        employee: personName,
        leaveType: leaveAllocationRequests.leaveTypeId,
        kind: leaveAllocationRequests.kind,
        status: leaveAllocationRequests.status,
        days: leaveAllocationRequests.days,
        branch: employees.workPropertyId,
        routedToMe: sql`coalesce(${leaveAllocationRequests.routedToEmployeeId} = ${input.me}::uuid, false)`,
        createdAt: leaveAllocationRequests.createdAt,
      },
      reader: 'basic',
      query: input.query,
      tieBreaker: leaveAllocationRequests.id,
    });
    const own = and(eq(leaveAllocationRequests.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  async allocationPage(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListRows<AllocationRow>> {
    const { compiled, own, where } = this.compiled(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.allocations().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(leaveAllocationRequests)
        .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
        .where(where),
      this.db
        .select({ value: leaveAllocationRequests.status, count: countAll })
        .from(leaveAllocationRequests)
        .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(leaveAllocationRequests.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(leaveAllocationRequests)
            .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as AllocationRow[],
      total: Number(count),
      groups: groupsOf(LEAVE_ALLOCATION_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async allocationIds(input: { orgId: string; scope: BranchScope; query: ListQuery; me: string | null }): Promise<ListIds> {
    const { compiled, where } = this.compiled(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: leaveAllocationRequests.id })
        .from(leaveAllocationRequests)
        .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.db
        .select({ count: countAll })
        .from(leaveAllocationRequests)
        .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
        .where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async findAllocation(id: string, tx?: Tx): Promise<AllocationRow | null> {
    const [row] = await this.allocations(tx).where(eq(leaveAllocationRequests.id, id)).limit(1);
    return (row as AllocationRow | undefined) ?? null;
  }

  async allocationsOf(employeeId: string): Promise<AllocationRow[]> {
    return (await this.allocations()
      .where(eq(leaveAllocationRequests.employeeId, employeeId))
      .orderBy(desc(leaveAllocationRequests.createdAt))
      .limit(200)) as AllocationRow[];
  }

  async allocationsRoutedTo(employeeId: string): Promise<AllocationRow[]> {
    return (await this.allocations()
      .where(eq(leaveAllocationRequests.routedToEmployeeId, employeeId))
      .orderBy(sql`${leaveAllocationRequests.status} = 'requested' desc`, desc(leaveAllocationRequests.createdAt))
      .limit(200)) as AllocationRow[];
  }

  /** Throws 23505 on `leave_allocation_requests_compensated_uk` for a date already compensated or asked. */
  async insertAllocation(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      leaveTypeId: string;
      kind: LeaveAllocationKind;
      days: number;
      attendanceRecordId: string | null;
      workDate: string | null;
      reason: string;
      routedToEmployeeId: string | null;
      requestedByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(leaveAllocationRequests).values(values).returning({ id: leaveAllocationRequests.id });
    return row.id;
  }

  /** Move an allocation request out of `requested`, only while it still is (of two racing decisions, one wins). */
  async moveAllocation(tx: Tx, id: string, to: LeaveAllocationStatus, extra: { decidedByUserId?: string; decisionNote?: string | null } = {}): Promise<boolean> {
    const decided = to === 'approved' || to === 'rejected';
    const rows = await tx
      .update(leaveAllocationRequests)
      .set({
        status: to,
        ...(decided ? { decidedAt: new Date(), decidedByUserId: extra.decidedByUserId ?? null, decisionNote: extra.decisionNote ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(leaveAllocationRequests.id, id), eq(leaveAllocationRequests.status, 'requested')))
      .returning({ id: leaveAllocationRequests.id });
    return rows.length > 0;
  }

  async waitingAllocations(orgId: string, scope: BranchScope): Promise<number> {
    const [row] = await this.db
      .select({ count: countAll })
      .from(leaveAllocationRequests)
      .innerJoin(employees, eq(employees.id, leaveAllocationRequests.employeeId))
      .where(and(eq(leaveAllocationRequests.orgId, orgId), inBranchScope(employees.workPropertyId, scope), eq(leaveAllocationRequests.status, 'requested')));
    return Number(row?.count ?? 0);
  }

  // --- Restricted periods (AC-LV9) --------------------------------------------------

  async periods(orgId: string, window?: { from: string; to: string }, tx?: Tx): Promise<PeriodRow[]> {
    const where = [eq(restrictedLeavePeriods.orgId, orgId)];
    if (window) where.push(lte(restrictedLeavePeriods.fromDate, window.to), gte(restrictedLeavePeriods.toDate, window.from));
    const rows = await (tx ?? this.db)
      .select({
        id: restrictedLeavePeriods.id,
        orgId: restrictedLeavePeriods.orgId,
        title: restrictedLeavePeriods.title,
        fromDate: restrictedLeavePeriods.fromDate,
        toDate: restrictedLeavePeriods.toDate,
        departmentId: restrictedLeavePeriods.departmentId,
        departmentName: departments.name,
        typeMode: restrictedLeavePeriods.typeMode,
        description: restrictedLeavePeriods.description,
      })
      .from(restrictedLeavePeriods)
      .leftJoin(departments, eq(departments.id, restrictedLeavePeriods.departmentId))
      .where(and(...where))
      .orderBy(asc(restrictedLeavePeriods.fromDate));
    if (rows.length === 0) return [];
    const scopes = await (tx ?? this.db)
      .select({ periodId: restrictedLeaveScopes.periodId, jobPositionId: restrictedLeaveScopes.jobPositionId, leaveTypeId: restrictedLeaveScopes.leaveTypeId })
      .from(restrictedLeaveScopes)
      .where(inArray(restrictedLeaveScopes.periodId, rows.map((r) => r.id)));
    return rows.map((r) => ({
      ...r,
      jobPositionIds: scopes.filter((s) => s.periodId === r.id && s.jobPositionId).map((s) => s.jobPositionId as string),
      leaveTypeIds: scopes.filter((s) => s.periodId === r.id && s.leaveTypeId).map((s) => s.leaveTypeId as string),
    }));
  }

  async findPeriod(id: string): Promise<PeriodRow | null> {
    const [row] = await this.db.select({ orgId: restrictedLeavePeriods.orgId }).from(restrictedLeavePeriods).where(eq(restrictedLeavePeriods.id, id)).limit(1);
    if (!row) return null;
    return (await this.periods(row.orgId)).find((p) => p.id === id) ?? null;
  }

  async insertPeriod(
    tx: Tx,
    values: {
      orgId: string;
      title: string;
      fromDate: string;
      toDate: string;
      departmentId: string | null;
      typeMode: RestrictedTypeMode;
      description: string | null;
      createdByUserId: string;
    },
    scopes: { jobPositionIds: readonly string[]; leaveTypeIds: readonly string[] },
  ): Promise<string> {
    const [row] = await tx.insert(restrictedLeavePeriods).values(values).returning({ id: restrictedLeavePeriods.id });
    await this.replaceScopes(tx, values.orgId, row.id, scopes);
    return row.id;
  }

  async updatePeriod(
    tx: Tx,
    id: string,
    orgId: string,
    values: Partial<{ title: string; fromDate: string; toDate: string; departmentId: string | null; typeMode: RestrictedTypeMode; description: string | null }>,
    scopes?: { jobPositionIds: readonly string[]; leaveTypeIds: readonly string[] },
  ): Promise<void> {
    if (Object.keys(values).length > 0) {
      await tx.update(restrictedLeavePeriods).set({ ...values, updatedAt: new Date() }).where(eq(restrictedLeavePeriods.id, id));
    }
    if (scopes) await this.replaceScopes(tx, orgId, id, scopes);
  }

  async deletePeriod(tx: Tx, id: string): Promise<void> {
    await tx.delete(restrictedLeavePeriods).where(eq(restrictedLeavePeriods.id, id));
  }

  private async replaceScopes(tx: Tx, orgId: string, periodId: string, scopes: { jobPositionIds: readonly string[]; leaveTypeIds: readonly string[] }): Promise<void> {
    await tx.delete(restrictedLeaveScopes).where(eq(restrictedLeaveScopes.periodId, periodId));
    const rows = [
      ...[...new Set(scopes.jobPositionIds)].map((jobPositionId) => ({ orgId, periodId, jobPositionId, leaveTypeId: null })),
      ...[...new Set(scopes.leaveTypeIds)].map((leaveTypeId) => ({ orgId, periodId, jobPositionId: null, leaveTypeId })),
    ];
    if (rows.length > 0) await tx.insert(restrictedLeaveScopes).values(rows);
  }

  /** The departments a person sits in (active rows), for matching a restricted period. */
  async departmentsOfPerson(employeeId: string, tx?: Tx): Promise<string[]> {
    const rows = await (tx ?? this.db)
      .select({ id: departmentMembers.departmentId })
      .from(departmentMembers)
      .where(and(eq(departmentMembers.employeeId, employeeId), eq(departmentMembers.status, 'active')));
    return rows.map((r) => r.id);
  }

  async departmentOf(id: string): Promise<{ id: string; orgId: string } | null> {
    const [row] = await this.db.select({ id: departments.id, orgId: departments.orgId }).from(departments).where(eq(departments.id, id)).limit(1);
    return row ?? null;
  }

  async ownIds(orgId: string, positions: readonly string[], types: readonly string[]): Promise<{ positions: number; types: number }> {
    const [p, t] = await Promise.all([
      positions.length === 0
        ? Promise.resolve([])
        : this.db.select({ id: jobPositions.id }).from(jobPositions).where(and(eq(jobPositions.orgId, orgId), inArray(jobPositions.id, [...positions]))),
      types.length === 0
        ? Promise.resolve([])
        : this.db.select({ id: leaveTypes.id }).from(leaveTypes).where(and(eq(leaveTypes.orgId, orgId), inArray(leaveTypes.id, [...types]))),
    ]);
    return { positions: p.length, types: t.length };
  }

  // --- Who may decide at a branch (AC-LV7) ---------------------------------------------

  /**
   * The active members of a business, their role, the branches a limited one
   * covers (none: every branch), and the business's role overrides: enough to
   * work out who holds a permission at a branch without asking the guard.
   */
  async members(orgId: string, tx?: Tx): Promise<{
    members: { membershipId: string; userId: string; orgRole: OrgRole; branchIds: string[] }[];
    overrides: RolePermissionOverride[];
  }> {
    const db = tx ?? this.db;
    const [rows, branches, overrides] = await Promise.all([
      db
        .select({ membershipId: orgMemberships.id, userId: orgMemberships.userId, orgRole: orgMemberships.orgRole })
        .from(orgMemberships)
        .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.status, 'active'))),
      db
        .select({ membershipId: orgMembershipBranches.orgMembershipId, propertyId: orgMembershipBranches.propertyId })
        .from(orgMembershipBranches)
        .innerJoin(orgMemberships, eq(orgMemberships.id, orgMembershipBranches.orgMembershipId))
        .where(eq(orgMemberships.orgId, orgId)),
      db
        .select({ orgRole: orgRolePermissions.orgRole, permission: orgRolePermissions.permission, granted: orgRolePermissions.granted })
        .from(orgRolePermissions)
        .where(eq(orgRolePermissions.orgId, orgId)),
    ]);
    return {
      members: rows.map((m) => ({
        membershipId: m.membershipId,
        userId: m.userId,
        orgRole: m.orgRole,
        branchIds: branches.filter((b) => b.membershipId === m.membershipId).map((b) => b.propertyId),
      })),
      overrides: overrides as RolePermissionOverride[],
    };
  }
}
