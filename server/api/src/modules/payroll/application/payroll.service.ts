// server/api/src/modules/payroll/application/payroll.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';

import { PayrollRepository } from '../infrastructure/payroll.repository';

/**
 * Mock statutory rates (HR module, first pass — no ADR yet).
 *
 * These are NOT the real Rwandan PAYE brackets or RSSB rates. PAYE is
 * genuinely progressive (tiered by income band) in Rwanda; this is a flat
 * stand-in so the payroll flow can be demoed end to end before that work is
 * done. Treat this the same way `RRA_TIN_ADAPTER_MODE=mock` and
 * `VSDC_ADAPTER_MODE=mock` are treated elsewhere in this codebase: clearly
 * fake, clearly labeled, never silently trusted as a real figure.
 */
const MOCK_PAYE_RATE = 0.15;
const MOCK_RSSB_EMPLOYEE_RATE = 0.06;
const MOCK_RSSB_EMPLOYER_RATE = 0.08;

export interface PayslipCalculation {
  grossRwf: number;
  payeRwf: number;
  rssbEmployeeRwf: number;
  rssbEmployerRwf: number;
  netRwf: number;
}

/** Pure calculation, kept separate from the service so it's trivial to test and to replace later. */
export function calculatePayslip(grossRwf: number): PayslipCalculation {
  const payeRwf = Math.round(grossRwf * MOCK_PAYE_RATE);
  const rssbEmployeeRwf = Math.round(grossRwf * MOCK_RSSB_EMPLOYEE_RATE);
  const rssbEmployerRwf = Math.round(grossRwf * MOCK_RSSB_EMPLOYER_RATE);
  const netRwf = grossRwf - payeRwf - rssbEmployeeRwf;

  return { grossRwf, payeRwf, rssbEmployeeRwf, rssbEmployerRwf, netRwf };
}

/**
 * HR / payroll use cases (first pass — no ADR yet, pending team review).
 *
 * Mirrors `TeamService`'s shape: thin, delegates data access to the
 * repository, resolves everything from the workspace the guard already
 * proved. Money never moves off a single click — a run must be explicitly
 * approved before it can be marked paid (mirrors the booking approval flow).
 */
@Injectable()
export class PayrollService {
  constructor(private readonly payroll: PayrollRepository) {}

  async listCompensation(workspaceId: string) {
    return this.payroll.listCompensation(workspaceId);
  }

  async setCompensation(
    workspaceId: string,
    departmentMemberId: string,
    baseSalaryRwf: number,
  ) {
    if (baseSalaryRwf <= 0) {
      throw new BadRequestException('Salary must be greater than zero.');
    }
    await this.payroll.setCompensation(workspaceId, departmentMemberId, baseSalaryRwf);
  }

  async listRuns(workspaceId: string) {
    return this.payroll.listRuns(workspaceId);
  }

  /**
   * Creates a run and calculates a payslip for every currently active,
   * compensated staff member in one pass. Staff with no salary set (still
   * showing on the roster with a 0) are skipped rather than paid nothing.
   */
  async createRun(workspaceId: string, periodStart: Date, periodEnd: Date) {
    const allStaff = await this.payroll.listCompensation(workspaceId);
    const staff = allStaff.filter((s) => s.baseSalaryRwf > 0);
    if (staff.length === 0) {
      throw new BadRequestException(
        'No staff have a salary set for this workspace yet.',
      );
    }

    const run = await this.payroll.createRun(workspaceId, periodStart, periodEnd);

    let totalGross = 0;
    let totalNet = 0;

    for (const member of staff) {
      const calc = calculatePayslip(member.baseSalaryRwf);
      await this.payroll.addPayslip(
        run.id,
        workspaceId,
        member.departmentMemberId,
        calc.grossRwf,
        calc.payeRwf,
        calc.rssbEmployeeRwf,
        calc.rssbEmployerRwf,
        calc.netRwf,
      );
      totalGross += calc.grossRwf;
      totalNet += calc.netRwf;
    }

    await this.payroll.updateRunTotals(run.id, totalGross, totalNet);

    return run;
  }

  async listPayslips(payrollRunId: string) {
    return this.payroll.listPayslips(payrollRunId);
  }

  async approveRun(payrollRunId: string, approvedByUserId: string) {
    await this.payroll.approveRun(payrollRunId, approvedByUserId);
  }

  /**
   * "Pays" a run. No real money moves (PAYROLL_ADAPTER_MODE is implicitly
   * mock for now, matching the payments and EBM adapters) — this just flips
   * the status, the same way the mock mobile money adapter settles a booking.
   */
  async markRunPaid(payrollRunId: string) {
    await this.payroll.markRunPaid(payrollRunId);
  }
}