import type { CreatePayAdjustmentRequest, ListQuery, PayAdjustment, PayAdjustmentPage } from '@injishi/contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { pageOf } from '../../../shared/lists/list-query';
import { firstOfMonth, lastOfMonth, monthOf } from '../domain/hr-calendar';
import { dayRatePay } from '../domain/pay-computation';
import { EmployeesRepository, type EmployeeRow, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { PayItemsRepository, type AdjustmentRow } from '../infrastructure/pay-items.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * Pay adjustments (058-payroll AC-PY16, index contract 17): the one remedy for
 * a confirmed month, which never changes. A holder of `payroll.run` records one
 * by hand; leave decided into a confirmed month (058-leave AC-LV9a) and a held
 * payslip (AC-PY7) write their own. The person's next unconfirmed run pays or
 * deducts each as an `adjustment` line, and confirming marks it paid, once.
 */
@Injectable()
export class PayAdjustmentsService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly items: PayItemsRepository,
    private readonly records: PayRecordsRepository,
  ) {}

  async list(ws: ScopedWorkspace, query: ListQuery): Promise<PayAdjustmentPage> {
    const page = await this.items.adjustmentPage({ orgId: orgOf(ws), scope: ws.branchScope, query });
    return pageOf(page.rows.map(presentAdjustment), page.total, query, { groups: page.groups, statusCounts: page.statusCounts });
  }

  /** `POST /ops/pay-adjustments`, once per `Idempotency-Key`. */
  async create(ws: ScopedWorkspace, userId: string, key: string, body: CreatePayAdjustmentRequest): Promise<PayAdjustment> {
    const orgId = orgOf(ws);
    const existing = await this.items.adjustmentByKey(orgId, key);
    if (existing) return this.presentById(existing);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const id = await this.employees.withEmployeeLock(employee.id, async (tx) => {
      const created = await this.items.insertAdjustment(tx, {
        orgId,
        employeeId: employee.id,
        side: body.side,
        amountRwf: body.amountRwf,
        taxable: body.taxable,
        contributable: body.contributable,
        correctsPeriod: body.correctsPeriod,
        reason: body.reason.trim(),
        source: 'manual',
        sourceId: null,
        createdByUserId: userId,
        idempotencyKey: key,
      });
      if (!created) return (await this.items.adjustmentByKey(orgId, key, tx)) as string;
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.pay_adjustment_recorded',
        orgId,
        diff: { adjustmentId: created, side: body.side, amountRwf: 'changed', correctsPeriod: body.correctsPeriod },
        reason: body.reason,
      });
      return created;
    });
    if (!id) throw new NotFoundException();
    return this.presentById(id);
  }

  async waive(ws: ScopedWorkspace, userId: string, id: string, reason: string): Promise<PayAdjustment> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.items.findAdjustment(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    const done = await this.employees.withEmployeeLock(row.employeeId, async (tx) => {
      if (!(await this.items.waiveAdjustment(tx, id))) throw new ConflictException(`That adjustment is ${row.status}, so it cannot be waived.`);
      await writeHrAudit(tx, { actorUserId: userId, subjectType: 'employee', subjectId: row.employeeId, eventType: 'hr.pay_adjustment_waived', orgId, diff: { adjustmentId: id }, reason });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id);
  }

  /**
   * Leave decided into a month whose pay is confirmed (058-leave AC-LV9a): the
   * unpaid share of each such day is a deduction on approval, given back as an
   * earning on cancellation, at the day rate of the contract it fell in. Written
   * in the decision's own transaction; answers how many it wrote.
   */
  async forLeave(
    tx: Tx,
    input: {
      employee: Pick<EmployeeRow, 'id' | 'orgId'>;
      requestId: string;
      payment: 'paid' | 'unpaid' | 'partial';
      paymentPercent: number | null;
      byMonth: readonly { period: string; days: number }[];
      direction: 'approve' | 'cancel';
      userId: string;
    },
  ): Promise<number> {
    if (input.payment === 'paid') return 0;
    const unpaidShare = input.payment === 'unpaid' ? 100 : 100 - (input.paymentPercent ?? 0);
    if (unpaidShare <= 0) return 0;
    let written = 0;
    for (const share of input.byMonth) {
      if (share.days <= 0) continue;
      if ((await this.records.fenceMonth(tx, input.employee.orgId, share.period)) !== 'confirmed') continue;
      const contracts = (await this.records.contractsWithStructure(input.employee.orgId, firstOfMonth(share.period), lastOfMonth(share.period), tx)).filter(
        (c) => c.employeeId === input.employee.id,
      );
      const contract = contracts[contracts.length - 1];
      if (!contract || contract.wageBasis !== 'monthly') continue;
      const amount = dayRatePay(contract, share.days, unpaidShare);
      if (amount <= 0) continue;
      await this.items.insertAdjustment(tx, {
        orgId: input.employee.orgId,
        employeeId: input.employee.id,
        side: input.direction === 'approve' ? 'deduction' : 'earning',
        amountRwf: amount,
        taxable: true,
        contributable: true,
        correctsPeriod: share.period,
        reason:
          input.direction === 'approve'
            ? `Leave in ${share.period}, after its pay was confirmed: ${share.days} day${share.days === 1 ? '' : 's'} not paid`
            : `Leave in ${share.period} cancelled after its pay was confirmed: ${share.days} day${share.days === 1 ? '' : 's'} given back`,
        source: 'leave',
        sourceId: input.requestId,
        createdByUserId: input.userId,
        idempotencyKey: null,
      });
      written += 1;
    }
    return written;
  }

  /**
   * A payslip held out of a draft run (AC-PY7): the month's earnings, not the
   * adjustments or claims already waiting, carried to the next month as one
   * taxable, contributable earning. The run reads the row to leave the person
   * out.
   */
  async forHold(tx: Tx, input: { orgId: string; employeeId: string; payRunId: string; period: string; grossRwf: number; reason: string; userId: string }): Promise<void> {
    await this.items.insertAdjustment(tx, {
      orgId: input.orgId,
      employeeId: input.employeeId,
      side: 'earning',
      amountRwf: input.grossRwf,
      taxable: true,
      contributable: true,
      correctsPeriod: input.period,
      reason: `Pay held from ${input.period}: ${input.reason}`,
      source: 'held_payslip',
      sourceId: input.payRunId,
      createdByUserId: input.userId,
      idempotencyKey: null,
    });
  }

  async presentById(id: string): Promise<PayAdjustment> {
    const row = await this.items.findAdjustment(id);
    if (!row) throw new NotFoundException();
    return presentAdjustment(row);
  }
}

export function presentAdjustment(r: AdjustmentRow): PayAdjustment {
  return {
    id: r.id,
    employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
    branchId: r.workPropertyId,
    side: r.side,
    amountRwf: r.amountRwf,
    taxable: r.taxable,
    contributable: r.contributable,
    correctsPeriod: r.correctsPeriod,
    reason: r.reason,
    source: r.source,
    status: r.status,
    paidInPeriod: r.paidInPeriod,
    createdAt: r.createdAt.toISOString(),
  };
}

/** `YYYY-MM` of each share of a leave, for the adjustments it may owe. */
export function sharesByPeriod(byMonth: readonly { effectiveOn: string; days: number }[]): { period: string; days: number }[] {
  const out = new Map<string, number>();
  for (const s of byMonth) out.set(monthOf(s.effectiveOn), (out.get(monthOf(s.effectiveOn)) ?? 0) + s.days);
  return [...out].map(([period, days]) => ({ period, days }));
}
