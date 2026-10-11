// server/api/src/modules/payroll/application/payroll.service.ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { AttendanceService } from '../../hr/application/attendance.service';
import { OVERTIME, computePayslip } from '../domain/pay-rules';
import { payslipFilename, toPayslipPage } from '../domain/payslip-page';
import {
  PayrollRepository,
  type PayrollRunRow,
  type PayslipRow,
  type StaffCompensationRow,
} from '../infrastructure/payroll.repository';
import { PayslipPdfRenderer } from '../infrastructure/payslip-pdf.renderer';

/** A stored UTC instant as the calendar day it names, which is what the roster is keyed by. */
const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * HR / payroll use cases (first pass — no ADR yet, pending team review).
 *
 * Mirrors `TeamService`'s shape: thin, delegates data access to the
 * repository, resolves everything from the workspace the guard already
 * proved. Money never moves off a single click — a run must be explicitly
 * approved before it can be marked paid (mirrors the booking approval flow).
 *
 * A PAYSLIP IS COMPUTED FROM THREE THINGS: the salary on record, what the
 * roster and the clock say about the month (`AttendanceService.payFacts`), and
 * the rules in `domain/pay-rules.ts`. Its lines are stored as they were
 * computed and never recomputed, so approving a run freezes what people were
 * told, whatever the salary or the rates become afterwards.
 *
 * EVERY RUN ID IS CHECKED AGAINST THE WORKSPACE. The guard proves the caller
 * manages THIS business; a run id arrives in the URL and could name anybody's.
 * Reading, approving and paying all look the run up inside the caller's
 * workspace first, and a run that is not theirs does not exist.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly payroll: PayrollRepository,
    private readonly attendance: AttendanceService,
    private readonly pdf: PayslipPdfRenderer,
    @Inject(PLATFORM) private readonly platform: Platform,
  ) {}

  async listCompensation(workspaceId: string): Promise<StaffCompensationRow[]> {
    return this.payroll.listCompensation(workspaceId);
  }

  async setCompensation(
    workspaceId: string,
    departmentMemberId: string,
    baseSalaryRwf: number,
  ): Promise<void> {
    if (baseSalaryRwf <= 0) {
      throw new BadRequestException('Salary must be greater than zero.');
    }
    await this.payroll.setCompensation(workspaceId, departmentMemberId, baseSalaryRwf);
  }

  async listRuns(workspaceId: string): Promise<PayrollRunRow[]> {
    return this.payroll.listRuns(workspaceId);
  }

  /**
   * Creates a run and calculates a payslip for every currently active,
   * compensated staff member in one pass. Staff with no salary set (still
   * showing on the roster with a 0) are skipped rather than paid nothing.
   */
  async createRun(
    workspaceId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ id: string; replaced: boolean }> {
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      throw new BadRequestException('Choose the month to run payroll for.');
    }
    const allStaff = await this.payroll.listCompensation(workspaceId);
    const staff = allStaff.filter((s) => s.baseSalaryRwf > 0);
    if (staff.length === 0) {
      throw new BadRequestException(
        'No staff have a salary set for this workspace yet.',
      );
    }

    // One run per period. The table's unique key already refuses a second one;
    // asking first turns that into a sentence the owner can read rather than a 500.
    const existing = await this.payroll.findRunForPeriod(workspaceId, periodStart, periodEnd);
    if (existing) {
      // ON THE DEMO ONLY, running a period again REPLACES its run, whatever
      // state it reached — somebody testing the flow has to be able to change
      // a salary and see the month recalculated. Nothing real was paid there
      // (the fixed sign-in code and the sample-data marker are what make a
      // process the demo). In production a second run is still refused, and a
      // paid run stays the record it is.
      if (this.platform.environment !== 'demo') {
        throw new ConflictException(
          'Payroll has already been run for this period.',
        );
      }
      await this.payroll.deletePayslips(existing);
      await this.payroll.deleteRun(existing);
    }

    const run = await this.payroll.createRun(workspaceId, periodStart, periodEnd);
    await this.fillRun(run.id, workspaceId, staff, periodStart, periodEnd);
    return { ...run, replaced: existing !== null };
  }

  /**
   * Writes one payslip per compensated staff member and the run's totals.
   *
   * The roster and the clock are read ONCE for the whole period, then each
   * person's month is looked up in that answer. A day still to come counts for
   * nothing, so a run made before the month ends is a figure so far:
   * recalculating the draft picks up the days since.
   */
  private async fillRun(
    runId: string,
    workspaceId: string,
    staff: readonly { departmentMemberId: string; baseSalaryRwf: number }[],
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const facts = await this.attendance.payFacts(
      workspaceId,
      dayOf(periodStart),
      dayOf(periodEnd),
      OVERTIME.fromMinutes,
    );
    let totalGross = 0;
    let totalNet = 0;

    for (const member of staff) {
      const attendance = facts.get(member.departmentMemberId) ?? null;
      const calc = computePayslip(member.baseSalaryRwf, attendance);
      await this.payroll.addPayslip({
        payrollRunId: runId,
        workspaceId,
        departmentMemberId: member.departmentMemberId,
        grossRwf: calc.grossRwf,
        payeRwf: calc.payeRwf,
        rssbEmployeeRwf: calc.employeeContributionsRwf,
        rssbEmployerRwf: calc.employerContributionsRwf,
        netRwf: calc.netRwf,
        lines: calc.lines,
        attendance,
      });
      totalGross += calc.grossRwf;
      totalNet += calc.netRwf;
    }

    await this.payroll.updateRunTotals(runId, totalGross, totalNet);
  }

  /** A run inside this workspace, or a refusal that does not say whose it is. */
  private async ownRun(
    workspaceId: string,
    payrollRunId: string,
  ): Promise<{ id: string; status: string; periodStart: Date; periodEnd: Date }> {
    const run = await this.payroll.findRun(workspaceId, payrollRunId);
    if (!run) throw new NotFoundException('That payroll run is not in this workspace.');
    return run;
  }

  /**
   * A run still in DRAFT, inside this workspace — the only kind that may be
   * recalculated or discarded. An approved or paid run is a record of what
   * people were told they would be paid; a salary changed afterwards belongs
   * to the next period's run, not to a rewrite of this one.
   */
  private async draftRun(
    workspaceId: string,
    payrollRunId: string,
  ): Promise<{ id: string; status: string; periodStart: Date; periodEnd: Date }> {
    const run = await this.ownRun(workspaceId, payrollRunId);
    if (run.status !== 'draft') {
      throw new ConflictException(
        `This run is already ${run.status}, so it can no longer be changed. New salaries apply from the next run.`,
      );
    }
    return run;
  }

  /** Rebuild a draft run's payslips from the salaries and the attendance as they stand now. */
  async recalculateRun(workspaceId: string, payrollRunId: string): Promise<void> {
    const run = await this.draftRun(workspaceId, payrollRunId);
    const allStaff = await this.payroll.listCompensation(workspaceId);
    const staff = allStaff.filter((s) => s.baseSalaryRwf > 0);
    if (staff.length === 0) {
      throw new BadRequestException('No staff have a salary set for this workspace yet.');
    }
    await this.payroll.deletePayslips(payrollRunId);
    await this.fillRun(payrollRunId, workspaceId, staff, run.periodStart, run.periodEnd);
  }

  /** Throw a draft run away, so the period can be run again from scratch. */
  async discardRun(workspaceId: string, payrollRunId: string): Promise<void> {
    await this.draftRun(workspaceId, payrollRunId);
    await this.payroll.deletePayslips(payrollRunId);
    await this.payroll.deleteRun(payrollRunId);
  }

  /** Staff cost per run and department, for the owner's month-by-month chart. */
  async costByDepartment(workspaceId: string): ReturnType<PayrollRepository['costByDepartment']> {
    return this.payroll.costByDepartment(workspaceId);
  }

  async listPayslips(workspaceId: string, payrollRunId: string): Promise<PayslipRow[]> {
    await this.ownRun(workspaceId, payrollRunId);
    return this.payroll.listPayslips(workspaceId, payrollRunId);
  }

  /** Approving freezes the run: from here its payslips are what people were told. */
  async approveRun(workspaceId: string, payrollRunId: string, approvedByUserId: string): Promise<void> {
    await this.draftRun(workspaceId, payrollRunId);
    await this.payroll.approveRun(payrollRunId, approvedByUserId);
  }

  /**
   * "Pays" a run. No real money moves (PAYROLL_ADAPTER_MODE is implicitly
   * mock for now, matching the payments and EBM adapters) — this just flips
   * the status, the same way the mock mobile money adapter settles a booking.
   * Only an approved run can be paid: a draft is still a working figure.
   */
  async markRunPaid(workspaceId: string, payrollRunId: string): Promise<void> {
    const run = await this.ownRun(workspaceId, payrollRunId);
    if (run.status !== 'approved') {
      throw new ConflictException(
        run.status === 'paid' ? 'This run has already been paid.' : 'Approve the run before marking it paid.',
      );
    }
    await this.payroll.markRunPaid(payrollRunId);
  }

  /** One payslip of this business as a PDF, drawn from what the payslip stored. */
  async payslipPdf(workspaceId: string, payslipId: string): Promise<{ filename: string; body: Buffer }> {
    const record = await this.payroll.findPayslip(workspaceId, payslipId);
    if (!record) throw new NotFoundException('That payslip is not in this workspace.');
    return { filename: payslipFilename(record), body: await this.pdf.render([toPayslipPage(record)]) };
  }
}
