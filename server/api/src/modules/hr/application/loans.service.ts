import type { CreateLoanRequest, ListQuery, Loan, LoanPage } from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { pageOf } from '../../../shared/lists/list-query';
import { isCalendarDate } from '../../pms/domain/pricing';
import { deferredSchedule, installmentSchedule } from '../domain/pay-items';
import { EmployeesRepository } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { PayItemsRepository, type InstallmentRow, type LoanRow } from '../infrastructure/pay-items.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * Loans and salary advances (058-payroll AC-PY8). Everything here is
 * `payroll.run`'s. A loan is recorded once per `Idempotency-Key`, its schedule
 * written with it, and each run deducts the month's installment. Only an
 * installment not yet paid ever moves, and never into a month already
 * confirmed: that month's run row is locked for share while it moves.
 */
@Injectable()
export class LoansService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly employees: EmployeesRepository,
    private readonly items: PayItemsRepository,
    private readonly records: PayRecordsRepository,
  ) {}

  async list(ws: ScopedWorkspace, query: ListQuery): Promise<LoanPage> {
    const page = await this.items.loanPage({ orgId: orgOf(ws), scope: ws.branchScope, query });
    const schedules = await this.items.schedules(page.rows.map((r) => r.id));
    return pageOf(page.rows.map((r) => presentLoan(r, schedules)), page.total, query, { groups: page.groups, statusCounts: page.statusCounts });
  }

  async get(ws: ScopedWorkspace, id: string): Promise<Loan> {
    const row = assertOwnedByOrg(await this.items.findLoan(id), ws);
    assertInBranchScope(ws, row.workPropertyId);
    return presentLoan(row, await this.items.schedules([id]));
  }

  /** `POST /ops/loans`: a second call with the same key answers the loan the first one recorded. */
  async create(ws: ScopedWorkspace, userId: string, key: string, body: CreateLoanRequest): Promise<Loan> {
    const orgId = orgOf(ws);
    const existing = await this.items.loanByKey(orgId, key);
    if (existing) return this.get(ws, existing);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left, so no loan can be given now.`);
    if (!isCalendarDate(body.givenOn)) throw new UnprocessableEntityException('That is not a real date.');
    if (body.installments > body.amountRwf) throw new UnprocessableEntityException('More installments than francs.');
    if (body.firstPeriod < body.givenOn.slice(0, 7)) throw new UnprocessableEntityException('Repayment cannot start before the loan is given.');
    const schedule = installmentSchedule(body.amountRwf, body.installments, body.firstPeriod);
    const id = await this.db.transaction(async (tx) => {
      // A loan paid out on a payslip lands in the month it is given; that month must still be open.
      if (body.paidOut === 'payslip' && (await this.records.fenceMonth(tx, orgId, body.givenOn.slice(0, 7))) === 'confirmed') {
        throw new ConflictException(`Pay for ${body.givenOn.slice(0, 7)} is confirmed, so a loan given then cannot be paid out on it. Give it outside Injishi, or date it in an open month.`);
      }
      if ((await this.records.fenceMonth(tx, orgId, body.firstPeriod)) === 'confirmed') {
        throw new ConflictException(`Pay for ${body.firstPeriod} is confirmed, so repayment must start in a later month.`);
      }
      const created = await this.items.insertLoan(
        tx,
        {
          orgId,
          employeeId: employee.id,
          kind: body.kind,
          amountRwf: body.amountRwf,
          givenOn: body.givenOn,
          installments: body.installments,
          firstPeriod: body.firstPeriod,
          paidOut: body.paidOut,
          reason: body.reason?.trim() || null,
          createdByUserId: userId,
          idempotencyKey: key,
        },
        schedule,
      );
      if (!created) return null;
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.loan_recorded',
        orgId,
        diff: { loanId: created, kind: body.kind, amountRwf: body.amountRwf, installments: body.installments, firstPeriod: body.firstPeriod, paidOut: body.paidOut },
      });
      return created;
    });
    return this.get(ws, id ?? ((await this.items.loanByKey(orgId, key)) as string));
  }

  /** `POST /ops/loans/:id/settle`: everything still owed is deducted in the chosen month (AC-PY8). */
  async settle(ws: ScopedWorkspace, userId: string, id: string, period: string): Promise<Loan> {
    const orgId = orgOf(ws);
    const loan = assertOwnedByOrg(await this.items.findLoan(id), ws);
    assertPersonInReach(ws, loan.workPropertyId);
    if (loan.settledAt) throw new ConflictException('That loan is repaid already.');
    await this.db.transaction(async (tx) => {
      await this.items.lockLoan(tx, id);
      if ((await this.records.fenceMonth(tx, orgId, period)) === 'confirmed') {
        throw new ConflictException(`Pay for ${period} is confirmed. Settle it in a later month.`);
      }
      const total = await this.items.settleInto(tx, id, period);
      if (total === 0) throw new ConflictException('Nothing is owed on that loan.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: loan.employeeId,
        eventType: 'hr.loan_settled_early',
        orgId,
        diff: { loanId: id, period, amountRwf: total },
      });
    });
    return this.get(ws, id);
  }

  /**
   * `POST /ops/loans/:id/installments/:period/defer`: the installment and every
   * later unpaid one move a month on (AC-PY7, AC-PY8), so the schedule keeps its
   * total. Refused for a month already confirmed.
   */
  async defer(ws: ScopedWorkspace, userId: string, id: string, period: string): Promise<Loan> {
    const orgId = orgOf(ws);
    const loan = assertOwnedByOrg(await this.items.findLoan(id), ws);
    assertPersonInReach(ws, loan.workPropertyId);
    await this.db.transaction(async (tx) => {
      await this.items.lockLoan(tx, id);
      if ((await this.records.fenceMonth(tx, orgId, period)) === 'confirmed') {
        throw new ConflictException(`Pay for ${period} is confirmed, so its installment has been taken.`);
      }
      const schedule = await this.items.schedules([id], tx);
      const target = schedule.find((i) => i.period === period);
      if (!target) throw new NotFoundException(`That loan has no installment in ${period}.`);
      if (target.payslipId) throw new ConflictException('That installment is paid.');
      const moves = deferredSchedule(schedule.filter((i) => !i.payslipId), period);
      for (const m of moves) await this.items.moveInstallment(tx, m.id, m.to, m.id === target.id ? m.from : null);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: loan.employeeId,
        eventType: 'hr.loan_installment_deferred',
        orgId,
        diff: { loanId: id, from: period, moved: moves.length },
      });
    });
    return this.get(ws, id);
  }

  /** A person's own loans (058-self-service AC-SS7). */
  async mine(employeeId: string): Promise<Loan[]> {
    const rows = await this.items.loansOf(employeeId);
    const schedules = await this.items.schedules(rows.map((r) => r.id));
    return rows.map((r) => presentLoan(r, schedules));
  }
}

export function presentLoan(row: LoanRow, schedules: readonly InstallmentRow[]): Loan {
  const own = schedules.filter((s) => s.loanId === row.id);
  const paidRwf = own.filter((s) => s.payslipId).reduce((a, s) => a + s.amountRwf, 0);
  return {
    id: row.id,
    employee: rosterCard({ id: row.employeeId, preferredName: row.preferredName, legalName: row.legalName, jobPositionTitle: row.jobPositionTitle }),
    branchId: row.workPropertyId,
    kind: row.kind,
    amountRwf: row.amountRwf,
    givenOn: row.givenOn,
    installments: row.installments,
    firstPeriod: row.firstPeriod,
    paidOut: row.paidOut,
    reason: row.reason,
    paidRwf,
    remainingRwf: row.amountRwf - paidRwf,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    schedule: own.map((s) => ({ id: s.id, period: s.period, amountRwf: s.amountRwf, deferredFrom: s.deferredFrom, paid: s.payslipId !== null })),
    createdAt: row.createdAt.toISOString(),
  };
}
