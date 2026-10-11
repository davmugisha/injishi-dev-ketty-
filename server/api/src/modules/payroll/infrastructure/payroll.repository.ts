// server/api/src/modules/payroll/infrastructure/payroll.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, desc, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import { departments } from '../../../database/drizzle/operations';
import { orgs, workspaces } from '../../../database/drizzle/org';
import {
  departmentMembers,
  payrollRuns,
  payslips,
  staffCompensation,
} from '../../../database/drizzle/schema';
import type { PayFacts, PayslipLine } from '../domain/pay-rules';
import type { PayslipRecord } from '../domain/payslip-page';

export interface StaffCompensationRow {
  id: string;
  departmentMemberId: string;
  /** Somebody with two jobs has two salaries; these tell the rows apart. */
  departmentName: string;
  jobTitle: string | null;
  /** Null for a staffer with no account. */
  userId: string | null;
  name: string | null;
  baseSalaryRwf: number;
  effectiveFrom: Date;
}

export interface PayrollRunRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  totalGrossRwf: number;
  totalNetRwf: number;
}

export interface PayslipRow {
  id: string;
  departmentMemberId: string;
  name: string | null;
  /** Somebody in two departments has two slips in a run; this tells them apart. */
  departmentName: string;
  jobTitle: string | null;
  grossRwf: number;
  payeRwf: number;
  rssbEmployeeRwf: number;
  rssbEmployerRwf: number;
  netRwf: number;
  status: string;
  /** How the amounts were reached. Empty on a payslip from before lines were kept. */
  lines: PayslipLine[];
  /** What the roster and the clock said about the month. Null on an older payslip. */
  attendance: PayFacts | null;
}

/** The job this record pays for: the latest employment fact that names one. */
const latestJobTitle = sql<string | null>`(
  select h.job_title from employment_history h
  where h.department_member_id = ${departmentMembers.id} and h.job_title is not null
  order by h.effective_from desc limit 1
)`;

/**
 * Payroll data access (HR module, first pass — no ADR yet).
 *
 * Mirrors `TeamRepository`'s shape: resolves everything from the workspace
 * the guard already proved, never from a caller-supplied id.
 */
@Injectable()
export class PayrollRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Every active staff member, with their current salary if one has been set.
   * Starts from department_members (the whole roster) rather than
   * staff_compensation, so somebody with no salary yet still appears, with a
   * blank to set their first one.
   */
  async listCompensation(workspaceId: string): Promise<StaffCompensationRow[]> {
    const rows = await this.db
      .select({
        id: staffCompensation.id,
        departmentMemberId: departmentMembers.id,
        userId: departmentMembers.userId,
        name: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        departmentName: departments.name,
        jobTitle: sql<string | null>`(
          select h.job_title from employment_history h
          where h.department_member_id = ${departmentMembers.id} and h.job_title is not null
          order by h.effective_from desc limit 1
        )`,
        baseSalaryRwf: staffCompensation.baseSalaryRwf,
        effectiveFrom: staffCompensation.effectiveFrom,
      })
      .from(departmentMembers)
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      // LEFT, not inner: a staffer with no account is still paid.
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .leftJoin(
        staffCompensation,
        and(
          eq(staffCompensation.departmentMemberId, departmentMembers.id),
          eq(staffCompensation.status, 'active'),
        ),
      )
      .where(
        and(
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
        ),
      );

    return rows.map((row) => ({
      id: row.id ?? row.departmentMemberId,
      departmentMemberId: row.departmentMemberId,
      departmentName: row.departmentName,
      jobTitle: row.jobTitle,
      userId: row.userId,
      name: row.name,
      baseSalaryRwf: row.baseSalaryRwf ?? 0,
      effectiveFrom: row.effectiveFrom ?? new Date(),
    }));
  }

  /** Set (or update) a staff member's salary. Inserts a new row; never updates one in place. */
  async setCompensation(
    workspaceId: string,
    departmentMemberId: string,
    baseSalaryRwf: number,
  ): Promise<void> {
    await this.db
      .update(staffCompensation)
      .set({ status: 'archived' })
      .where(
        and(
          eq(staffCompensation.departmentMemberId, departmentMemberId),
          eq(staffCompensation.status, 'active'),
        ),
      );

    await this.db.insert(staffCompensation).values({
      workspaceId,
      departmentMemberId,
      baseSalaryRwf,
      effectiveFrom: new Date(),
      status: 'active',
    });
  }

  async listRuns(workspaceId: string): Promise<PayrollRunRow[]> {
    return this.db
      .select({
        id: payrollRuns.id,
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
        status: payrollRuns.status,
        totalGrossRwf: payrollRuns.totalGrossRwf,
        totalNetRwf: payrollRuns.totalNetRwf,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.workspaceId, workspaceId))
      .orderBy(desc(payrollRuns.periodStart));
  }

  /** The run already made for this period, or null when there is none. */
  async findRunForPeriod(
    workspaceId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<string | null> {
    const [row] = await this.db
      .select({ id: payrollRuns.id })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.workspaceId, workspaceId),
          eq(payrollRuns.periodStart, periodStart),
          eq(payrollRuns.periodEnd, periodEnd),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  /** One run, looked up inside the caller's workspace, or null when it is not theirs. */
  async findRun(
    workspaceId: string,
    payrollRunId: string,
  ): Promise<{ id: string; status: string; periodStart: Date; periodEnd: Date } | null> {
    const [row] = await this.db
      .select({
        id: payrollRuns.id,
        status: payrollRuns.status,
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
      })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.workspaceId, workspaceId)))
      .limit(1);
    return row ?? null;
  }

  async deletePayslips(payrollRunId: string): Promise<void> {
    await this.db.delete(payslips).where(eq(payslips.payrollRunId, payrollRunId));
  }

  async deleteRun(payrollRunId: string): Promise<void> {
    await this.db.delete(payrollRuns).where(eq(payrollRuns.id, payrollRunId));
  }

  async createRun(
    workspaceId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(payrollRuns)
      .values({ workspaceId, periodStart, periodEnd })
      .returning({ id: payrollRuns.id });
    return row;
  }

  /**
   * What each run cost, department by department: gross pay plus the
   * employer's own RSSB contribution, which is the business's real outlay and
   * appears on no payslip total. One grouped read across every run.
   */
  async costByDepartment(workspaceId: string): Promise<
    {
      payrollRunId: string;
      periodStart: Date;
      periodEnd: Date;
      status: string;
      departmentName: string;
      grossRwf: number;
      employerRssbRwf: number;
      payslips: number;
    }[]
  > {
    return this.db
      .select({
        payrollRunId: payrollRuns.id,
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
        status: payrollRuns.status,
        departmentName: departments.name,
        grossRwf: sql<number>`sum(${payslips.grossRwf})::float8`,
        employerRssbRwf: sql<number>`sum(${payslips.rssbEmployerRwf})::float8`,
        payslips: sql<number>`count(*)::int`,
      })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payrollRunId))
      .innerJoin(departmentMembers, eq(departmentMembers.id, payslips.departmentMemberId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(eq(payrollRuns.workspaceId, workspaceId))
      .groupBy(payrollRuns.id, departments.name)
      .orderBy(payrollRuns.periodStart);
  }

  /**
   * A run's payslips. The workspace is in the `where` beside the run: a run id
   * from another business matches nothing rather than listing its pay.
   */
  async listPayslips(workspaceId: string, payrollRunId: string): Promise<PayslipRow[]> {
    const rows = await this.db
      .select({
        id: payslips.id,
        departmentMemberId: payslips.departmentMemberId,
        name: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        departmentName: departments.name,
        jobTitle: latestJobTitle,
        grossRwf: payslips.grossRwf,
        payeRwf: payslips.payeRwf,
        rssbEmployeeRwf: payslips.rssbEmployeeRwf,
        rssbEmployerRwf: payslips.rssbEmployerRwf,
        netRwf: payslips.netRwf,
        status: payslips.status,
        lines: payslips.lines,
        attendance: payslips.attendance,
      })
      .from(payslips)
      .innerJoin(
        departmentMembers,
        eq(departmentMembers.id, payslips.departmentMemberId),
      )
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .where(and(eq(payslips.payrollRunId, payrollRunId), eq(payslips.workspaceId, workspaceId)));

    return rows;
  }

  /** One payslip with what a page of it needs, inside the caller's workspace. */
  async findPayslip(workspaceId: string, payslipId: string): Promise<PayslipRecord | undefined> {
    const [row] = await this.db
      .select({
        id: payslips.id,
        businessName: orgs.legalName,
        personName: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        jobTitle: latestJobTitle,
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
      .where(and(eq(payslips.id, payslipId), eq(payslips.workspaceId, workspaceId)))
      .limit(1);
    return row;
  }

  async addPayslip(values: {
    payrollRunId: string;
    workspaceId: string;
    departmentMemberId: string;
    grossRwf: number;
    payeRwf: number;
    rssbEmployeeRwf: number;
    rssbEmployerRwf: number;
    netRwf: number;
    lines: PayslipLine[];
    attendance: PayFacts | null;
  }): Promise<void> {
    await this.db.insert(payslips).values(values);
  }

  async updateRunTotals(
    payrollRunId: string,
    totalGross: number,
    totalNet: number,
  ): Promise<void> {
    await this.db
      .update(payrollRuns)
      .set({ totalGrossRwf: totalGross, totalNetRwf: totalNet })
      .where(eq(payrollRuns.id, payrollRunId));
  }

  async approveRun(payrollRunId: string, approvedByUserId: string): Promise<void> {
    await this.db
      .update(payrollRuns)
      .set({
        status: 'approved',
        approvedByUserId,
        approvedAt: new Date(),
      })
      .where(eq(payrollRuns.id, payrollRunId));
  }

  async markRunPaid(payrollRunId: string): Promise<void> {
    await this.db
      .update(payrollRuns)
      .set({ status: 'paid' })
      .where(eq(payrollRuns.id, payrollRunId));

    await this.db
      .update(payslips)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(payslips.payrollRunId, payrollRunId));
  }
}