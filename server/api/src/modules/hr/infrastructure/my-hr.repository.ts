import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { checklistItems, leaveRequests } from '../../../database/drizzle/hr-lifecycle';
import { users } from '../../../database/drizzle/auth';
import { departmentMembers, departments } from '../../../database/drizzle/operations';
import { orgs, workspaces } from '../../../database/drizzle/org';
import { payrollRuns, payslips } from '../../../database/drizzle/payroll';
import type { PayslipRecord } from '../../payroll/domain/payslip-page';

export interface MyEmploymentRow {
  departmentMemberId: string;
  departmentName: string;
  isPrimary: boolean;
}

/**
 * One person's OWN HR records (HR module, self-service — first pass, no ADR
 * yet).
 *
 * Every read here starts from `employments`, which resolves the caller's
 * `department_members` rows from the session's user id inside the workspace
 * the guard proved. No method takes a member id from a request: the ids these
 * reads are filtered by are the ones this repository looked up itself, so a
 * caller cannot name somebody else's.
 */
@Injectable()
export class MyHrRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The rows that make this user an employee here. Several when they work in
   * more than one department; the primary one first.
   */
  async employments(workspaceId: string, userId: string): Promise<MyEmploymentRow[]> {
    return this.db
      .select({
        departmentMemberId: departmentMembers.id,
        departmentName: departments.name,
        isPrimary: departmentMembers.isPrimary,
      })
      .from(departmentMembers)
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.userId, userId),
          eq(departmentMembers.status, 'active'),
        ),
      )
      .orderBy(desc(departmentMembers.isPrimary), asc(departments.name));
  }

  async leaveRequests(memberIds: readonly string[]) {
    if (memberIds.length === 0) return [];
    return this.db
      .select({
        id: leaveRequests.id,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        decidedAt: leaveRequests.decidedAt,
      })
      .from(leaveRequests)
      .where(inArray(leaveRequests.departmentMemberId, [...memberIds]))
      .orderBy(desc(leaveRequests.startDate));
  }

  /**
   * Delete one of the caller's OWN requests while it is still waiting. The
   * `where` carries the member ids this repository resolved and the pending
   * status, so somebody else's request, or one HR has already answered,
   * matches no row and answers false.
   */
  async withdrawLeave(memberIds: readonly string[], requestId: string): Promise<boolean> {
    if (memberIds.length === 0) return false;
    const rows = await this.db
      .delete(leaveRequests)
      .where(
        and(
          eq(leaveRequests.id, requestId),
          inArray(leaveRequests.departmentMemberId, [...memberIds]),
          eq(leaveRequests.status, 'pending'),
        ),
      )
      .returning({ id: leaveRequests.id });
    return rows.length > 0;
  }

  async tasks(memberIds: readonly string[]) {
    if (memberIds.length === 0) return [];
    return this.db
      .select({
        id: checklistItems.id,
        kind: checklistItems.kind,
        label: checklistItems.label,
        sortOrder: checklistItems.sortOrder,
        assigneeRole: checklistItems.assigneeRole,
        dueDate: checklistItems.dueDate,
        done: checklistItems.done,
        completedAt: checklistItems.completedAt,
      })
      .from(checklistItems)
      .where(inArray(checklistItems.departmentMemberId, [...memberIds]))
      .orderBy(asc(checklistItems.done), asc(checklistItems.dueDate));
  }

  /**
   * Tick or untick one of the caller's OWN tasks. The `where` carries the
   * member ids this repository resolved, so a task id belonging to somebody
   * else matches no row and answers false rather than being changed.
   */
  async setTaskDone(
    memberIds: readonly string[],
    itemId: string,
    done: boolean,
    userId: string,
  ): Promise<boolean> {
    if (memberIds.length === 0) return false;
    const rows = await this.db
      .update(checklistItems)
      .set({
        done,
        completedAt: done ? new Date() : null,
        completedByUserId: done ? userId : null,
      })
      .where(
        and(
          eq(checklistItems.id, itemId),
          inArray(checklistItems.departmentMemberId, [...memberIds]),
        ),
      )
      .returning({ id: checklistItems.id });
    return rows.length > 0;
  }

  /**
   * Payslips on runs that have been APPROVED or PAID. A draft run is HR still
   * working a figure out, and nobody should read their pay off a number that
   * may change before it is signed off.
   */
  async payslips(memberIds: readonly string[]) {
    if (memberIds.length === 0) return [];
    return this.db
      .select({
        id: payslips.id,
        // Somebody in two departments is paid once per department record, so
        // two slips share a period and only the department tells them apart.
        departmentName: departments.name,
        // The job this slip pays for, from the latest employment fact that
        // names one. "Manager" says whose salary it is where a bare department
        // name read like something bought.
        jobTitle: sql<string | null>`(
          select h.job_title from employment_history h
          where h.department_member_id = ${departmentMembers.id} and h.job_title is not null
          order by h.effective_from desc limit 1
        )`,
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
        runStatus: payrollRuns.status,
        grossRwf: payslips.grossRwf,
        payeRwf: payslips.payeRwf,
        rssbEmployeeRwf: payslips.rssbEmployeeRwf,
        rssbEmployerRwf: payslips.rssbEmployerRwf,
        netRwf: payslips.netRwf,
        status: payslips.status,
        paidAt: payslips.paidAt,
        // How the amounts were reached, and the month's attendance behind them.
        lines: payslips.lines,
        attendance: payslips.attendance,
      })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payrollRunId))
      .innerJoin(departmentMembers, eq(departmentMembers.id, payslips.departmentMemberId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          inArray(payslips.departmentMemberId, [...memberIds]),
          inArray(payrollRuns.status, ['approved', 'paid']),
        ),
      )
      .orderBy(desc(payrollRuns.periodStart));
  }

  /**
   * One of the caller's OWN payslips, with what a page of it needs. The
   * `where` carries the member ids this repository resolved and the same
   * approved-or-paid rule as the list, so somebody else's payslip, and a draft
   * of the caller's own, both match no row.
   */
  async findOwnPayslip(memberIds: readonly string[], payslipId: string): Promise<PayslipRecord | undefined> {
    if (memberIds.length === 0) return undefined;
    const [row] = await this.db
      .select({
        id: payslips.id,
        businessName: orgs.legalName,
        personName: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        jobTitle: sql<string | null>`(
          select h.job_title from employment_history h
          where h.department_member_id = ${departmentMembers.id} and h.job_title is not null
          order by h.effective_from desc limit 1
        )`,
        departmentName: departments.name,
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
        runStatus: payrollRuns.status,
        paidAt: payslips.paidAt,
        grossRwf: payslips.grossRwf,
        payeRwf: payslips.payeRwf,
        rssbEmployeeRwf: payslips.rssbEmployeeRwf,
        rssbEmployerRwf: payslips.rssbEmployerRwf,
        netRwf: payslips.netRwf,
        lines: payslips.lines,
        attendance: payslips.attendance,
      })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payrollRunId))
      .innerJoin(departmentMembers, eq(departmentMembers.id, payslips.departmentMemberId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .innerJoin(workspaces, eq(workspaces.id, payslips.workspaceId))
      .leftJoin(orgs, eq(orgs.id, workspaces.orgId))
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .where(
        and(
          eq(payslips.id, payslipId),
          inArray(payslips.departmentMemberId, [...memberIds]),
          inArray(payrollRuns.status, ['approved', 'paid']),
        ),
      )
      .limit(1);
    return row;
  }
}
