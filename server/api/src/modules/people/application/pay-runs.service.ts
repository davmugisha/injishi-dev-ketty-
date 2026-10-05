import type {
  PayRun,
  PayRunBlocker,
  PayRunDetail,
  ListQuery,
  PayRunPage,
  PayRunRuleVersion,
  Payslip,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { pageOf } from '../../../shared/lists/list-query';
import { firstOfMonth, lastOfMonth, monthOf } from '../domain/hr-calendar';
import { HR_RULE, missingRuleMessage } from '../domain/hr-rules';
import { computePayslip, type ComputedPayslip, type PayContract } from '../domain/pay-computation';
import type { ContractRow, Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import {
  PayrollRepository,
  type PayRunRow,
  type PayslipRow,
} from '../infrastructure/payroll.repository';
import { displayNameOf } from './employee-presenter';
import { orgOf } from './hr-access';

interface Computation {
  slips: (ComputedPayslip & { employeeId: string })[];
  ruleVersions: PayRunRuleVersion[];
  blockers: PayRunBlocker[];
}

/**
 * Pay runs (ADR-058, first thread). Every route needs `payroll.run`.
 *
 * A draft is only a preview. Confirming computes the run AGAIN inside its own
 * transaction and freezes what it computed, because anything that changed since
 * the draft (an offboarding, a late correction, an approved leave) would
 * otherwise be frozen wrong (AC-Y3). Nothing computes without a PAYE and an
 * RSSB rule in force on the month's first day (AC-Y2).
 */
@Injectable()
export class PayRunsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payroll: PayrollRepository,
    private readonly leave: LeaveRepository,
    private readonly rules: HrRulesRepository,
  ) {}

  /** `GET /ops/pay-runs`: one page through the list contract, newest month first by default. */
  async list(ws: ScopedWorkspace, query: ListQuery): Promise<PayRunPage> {
    const page = await this.payroll.listRunsPage(orgOf(ws), query);
    return pageOf(page.rows.map(presentRun), page.total, query, { statusCounts: page.statusCounts });
  }

  async get(ws: ScopedWorkspace, id: string): Promise<PayRunDetail> {
    const run = assertOwnedByOrg(await this.payroll.findRun(id), ws);
    return this.detail(run);
  }

  /** `POST /ops/pay-runs`: a draft for a month, computed. */
  async create(ws: ScopedWorkspace, userId: string, period: string): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    const id = await this.db.transaction(async (tx) => {
      const computed = await this.compute(tx, orgId, period);
      const runId = await this.payroll.insertRun(tx, {
        orgId,
        periodStart: firstOfMonth(period),
        ruleVersions: computed.ruleVersions,
      });
      if (!runId) throw new ConflictException(`There is already a pay run for ${period}.`);
      await this.payroll.upsertPayslips(tx, { orgId, payRunId: runId, status: 'draft', slips: computed.slips });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: runId,
        eventType: 'hr.pay_run_created',
        orgId,
        diff: { period, payslips: computed.slips.length, blockers: computed.blockers.length },
      });
      return runId;
    });
    return this.get(ws, id);
  }

  /** `POST /ops/pay-runs/:id/recompute`: a draft only. */
  async recompute(ws: ScopedWorkspace, userId: string, id: string): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.payroll.findRun(id), ws);
    await this.db.transaction(async (tx) => {
      const run = await this.payroll.lockRun(tx, id);
      if (!run) throw new NotFoundException();
      if (run.status === 'confirmed') {
        throw new ConflictException('A confirmed pay run never changes. Put a correction on a later run.');
      }
      const period = monthOf(run.periodStart);
      const computed = await this.compute(tx, orgId, period);
      await this.payroll.upsertPayslips(tx, { orgId, payRunId: id, status: 'draft', slips: computed.slips });
      await this.payroll.dropStaleDrafts(tx, id, computed.slips.map((s) => s.employeeId));
      await this.payroll.markComputed(tx, id, computed.ruleVersions);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: id,
        eventType: 'hr.pay_run_recomputed',
        orgId,
        diff: { period, payslips: computed.slips.length, blockers: computed.blockers.length },
      });
    });
    return this.get(ws, id);
  }

  /**
   * `POST /ops/pay-runs/:id/confirm`. Refused with EVERY blocker listed; a
   * second confirm answers with the same run (AC-Y3).
   */
  async confirm(ws: ScopedWorkspace, userId: string, id: string): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.payroll.findRun(id), ws);
    await this.db.transaction(async (tx) => {
      const run = await this.payroll.lockRun(tx, id);
      if (!run) throw new NotFoundException();
      if (run.status === 'confirmed') return;
      const period = monthOf(run.periodStart);
      const computed = await this.compute(tx, orgId, period);
      if (computed.blockers.length > 0) {
        throw new ConflictException({
          code: 'pay_run_blocked',
          message: `This run cannot be confirmed yet: ${computed.blockers.length} thing${computed.blockers.length === 1 ? '' : 's'} to fix first.`,
          blockers: computed.blockers,
        });
      }
      // What was computed just now is what is frozen, never the draft.
      await this.payroll.dropStaleDrafts(tx, id, computed.slips.map((s) => s.employeeId));
      await this.payroll.upsertPayslips(tx, {
        orgId,
        payRunId: id,
        status: 'confirmed',
        slips: computed.slips,
      });
      await this.payroll.markComputed(tx, id, computed.ruleVersions);
      await this.payroll.markConfirmed(tx, id, userId);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: id,
        eventType: 'hr.pay_run_confirmed',
        orgId,
        diff: {
          period,
          payslips: computed.slips.length,
          grossRwf: computed.slips.reduce((s, p) => s + p.grossRwf, 0),
          netRwf: computed.slips.reduce((s, p) => s + p.netRwf, 0),
        },
      });
    });
    return this.get(ws, id);
  }

  // --- The computation -----------------------------------------------------

  /**
   * Every payslip of a month, from the rows as they are inside `tx` (AC-Y1,
   * AC-Y2), and what would stop the month being confirmed.
   */
  private async compute(tx: Tx, orgId: string, period: string): Promise<Computation> {
    const first = firstOfMonth(period);
    const last = lastOfMonth(period);
    const paye = await this.rules.paye(first, tx);
    if (!paye) throw new ConflictException(missingRuleMessage(HR_RULE.paye, first));
    const rssb = await this.rules.rssb(first, tx);
    if (!rssb) throw new ConflictException(missingRuleMessage(HR_RULE.rssb, first));

    const contracts = await this.payroll.contractsOverlapping(orgId, first, last, tx);
    const unmonthly = contracts.find((c) => c.wageBasis !== 'monthly');
    if (unmonthly) {
      throw new ConflictException(
        'A daily or hourly contract falls in this month, and only monthly wages can be paid so far.',
      );
    }
    const byEmployee = new Map<string, ContractRow[]>();
    for (const c of contracts) {
      const list = byEmployee.get(c.employeeId) ?? [];
      list.push(c);
      byEmployee.set(c.employeeId, list);
    }

    // Unpaid leave in the month, each ledger row attributed to the contract in
    // force on the day it is dated.
    const unpaid = await this.leave.unpaidInMonth(orgId, first, last, tx);
    const unpaidByContract = new Map<string, number>();
    for (const row of unpaid) {
      const own = byEmployee.get(row.employeeId);
      if (!own) continue;
      const contract =
        own.find((c) => c.startsOn <= row.effectiveOn && (c.endsOn === null || c.endsOn >= row.effectiveOn)) ??
        own[own.length - 1];
      // `taken` rows are negative and reversals positive, so unpaid days are
      // the negated sum.
      unpaidByContract.set(contract.id, (unpaidByContract.get(contract.id) ?? 0) - row.days);
    }

    const slips = [...byEmployee.entries()].map(([employeeId, own]) => ({
      employeeId,
      ...computePayslip({
        period,
        contracts: own.map(
          (c): PayContract => ({
            id: c.id,
            startsOn: c.startsOn,
            endsOn: c.endsOn,
            wageBasis: c.wageBasis,
            wageRwf: c.wageRwf,
          }),
        ),
        unpaidDaysByContract: new Map(
          own.map((c) => [c.id, Math.max(0, unpaidByContract.get(c.id) ?? 0)]),
        ),
        paye: paye.value,
        rssb: rssb.value,
      }),
    }));

    return {
      slips,
      ruleVersions: [
        { configType: HR_RULE.paye, configEntryId: paye.configEntryId, version: paye.version },
        { configType: HR_RULE.rssb, configEntryId: rssb.configEntryId, version: rssb.version },
      ],
      blockers: await this.blockers(tx, [...byEmployee.keys()], first, last),
    };
  }

  /** Everything that would make a frozen month wrong, for every person (AC-Y3). */
  private async blockers(tx: Tx, employeeIds: string[], first: string, last: string): Promise<PayRunBlocker[]> {
    const people = await this.payroll.coveredPeople(employeeIds, tx);
    const names = new Map(people.map((p) => [p.employeeId, displayNameOf(p)]));
    const out: PayRunBlocker[] = [];
    for (const p of people) {
      const name = names.get(p.employeeId) ?? '';
      if (!p.rssbNumber) {
        out.push({
          code: 'missing_rssb_number',
          employeeId: p.employeeId,
          displayName: name,
          message: `${name} has no RSSB number on file.`,
        });
      }
      if (!p.idDocumentType || !p.idDocumentNumber) {
        out.push({
          code: 'missing_id',
          employeeId: p.employeeId,
          displayName: name,
          message: `${name} has no ID on file.`,
        });
      }
    }
    const attendance = await this.payroll.unsettledAttendance(employeeIds, first, last, tx);
    const seen = new Set<string>();
    for (const a of attendance) {
      const name = names.get(a.employeeId) ?? '';
      const code = a.open ? 'open_attendance' : 'unvalidated_attendance';
      const key = `${a.employeeId}:${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        code,
        employeeId: a.employeeId,
        displayName: name,
        message: a.open
          ? `${name} is still clocked in on a day in this month.`
          : a.autoClosed
            ? `${name} has a record the sweep closed with guessed times. Correct it with the real ones.`
            : a.source === 'phone'
              ? `${name} clocked in by phone on a day nobody has validated yet.`
              : `${name} clocked themselves in on a day nobody has validated yet.`,
      });
    }
    return out;
  }

  private async detail(run: PayRunRow): Promise<PayRunDetail> {
    const slips = await this.payroll.payslips(run.id);
    let blockers: PayRunBlocker[] = [];
    if (run.status === 'draft') {
      const period = monthOf(run.periodStart);
      blockers = await this.db.transaction((tx) =>
        this.blockers(
          tx,
          slips.map((s) => s.employeeId),
          firstOfMonth(period),
          lastOfMonth(period),
        ),
      );
    }
    return { run: presentRun(run), payslips: slips.map(presentPayslip), blockers };
  }
}

function presentRun(row: PayRunRow): PayRun {
  return {
    id: row.id,
    period: monthOf(row.periodStart),
    periodStart: row.periodStart,
    status: row.status,
    computedAt: row.computedAt.toISOString(),
    ruleVersions: row.ruleVersions,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    confirmedByUserId: row.confirmedByUserId,
    headcount: row.headcount,
    grossRwf: row.grossRwf,
    netRwf: row.netRwf,
    payeRwf: row.payeRwf,
    employeeContributionsRwf: row.employeeContributionsRwf,
    employerContributionsRwf: row.employerContributionsRwf,
  };
}

function presentPayslip(row: PayslipRow): Payslip {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    displayName: displayNameOf(row),
    contractId: row.contractId,
    payableDays: row.payableDays,
    grossRwf: row.grossRwf,
    payeRwf: row.payeRwf,
    employeeContributionsRwf: row.employeeContributionsRwf,
    employerContributionsRwf: row.employerContributionsRwf,
    otherDeductionsRwf: row.otherDeductionsRwf,
    netRwf: row.netRwf,
    lines: row.lines,
    status: row.status,
  };
}
