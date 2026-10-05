// server/api/src/modules/payroll/infrastructure/payroll.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import {
  departmentMembers,
  payrollRuns,
  payslips,
  staffCompensation,
} from '../../../database/drizzle/schema';

export interface StaffCompensationRow {
  id: string;
  departmentMemberId: string;
  userId: string;
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
  grossRwf: number;
  payeRwf: number;
  rssbEmployeeRwf: number;
  rssbEmployerRwf: number;
  netRwf: number;
  status: string;
}

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
        name: users.name,
        baseSalaryRwf: staffCompensation.baseSalaryRwf,
        effectiveFrom: staffCompensation.effectiveFrom,
      })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
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

  async listPayslips(payrollRunId: string): Promise<PayslipRow[]> {
    const rows = await this.db
      .select({
        id: payslips.id,
        departmentMemberId: payslips.departmentMemberId,
        name: users.name,
        grossRwf: payslips.grossRwf,
        payeRwf: payslips.payeRwf,
        rssbEmployeeRwf: payslips.rssbEmployeeRwf,
        rssbEmployerRwf: payslips.rssbEmployerRwf,
        netRwf: payslips.netRwf,
        status: payslips.status,
      })
      .from(payslips)
      .innerJoin(
        departmentMembers,
        eq(departmentMembers.id, payslips.departmentMemberId),
      )
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .where(eq(payslips.payrollRunId, payrollRunId));

    return rows;
  }

  async addPayslip(
    payrollRunId: string,
    workspaceId: string,
    departmentMemberId: string,
    gross: number,
    paye: number,
    rssbEmployee: number,
    rssbEmployer: number,
    net: number,
  ): Promise<void> {
    await this.db.insert(payslips).values({
      payrollRunId,
      workspaceId,
      departmentMemberId,
      grossRwf: gross,
      payeRwf: paye,
      rssbEmployeeRwf: rssbEmployee,
      rssbEmployerRwf: rssbEmployer,
      netRwf: net,
    });
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