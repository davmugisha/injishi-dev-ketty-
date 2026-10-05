import type {
  HoldPayslipRequest,
  ListQuery,
  PayRun,
  PayRunBlocker,
  PayRunDetail,
  PayRunPage,
  PayRunRemedy,
  PayRunRuleVersion,
  Payslip,
  PayslipLine,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { pageOf } from '../../../shared/lists/list-query';
import { firstOfMonth, kigaliToday, lastOfMonth, monthOf } from '../domain/hr-calendar';
import { HR_RULE, missingRuleMessage } from '../domain/hr-rules';
import { computePayslip, dayRatePay, type ComputedPayslip, type DayKind, type PayComponentInput, type PayContract } from '../domain/pay-computation';
import { componentApplies, deferredSchedule, fullYears, maskAccount, nextPeriod, type ConditionSubject } from '../domain/pay-items';
import { EmployeesRepository, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { PayItemsRepository, type ComponentRow } from '../infrastructure/pay-items.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { PayrollRepository, type PayRunRow, type PayslipRow } from '../infrastructure/payroll.repository';
import { AttendanceCloser } from './attendance-closer';
import { displayNameOf } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';
import { LeaveService } from './leave.service';
import { PayAdjustmentsService } from './pay-adjustments.service';

interface Computation {
  slips: (ComputedPayslip & { employeeId: string })[];
  ruleVersions: PayRunRuleVersion[];
  blockers: PayRunBlocker[];
  /** A leaver's unused encashable leave, paid on this run and zeroed at confirm (AC-PY13). */
  settlementLeave: Map<string, { leaveTypeId: string; days: number; lastDay: string }[]>;
  /** Loans whose installments this run takes: settled at confirm when nothing is left. */
  loanIds: string[];
}

/**
 * Pay runs (ADR-058; 058-payroll in full). Every route needs `payroll.run`.
 *
 * A draft is only a preview. Confirming computes the run AGAIN inside its own
 * transaction, under the run's row lock, and freezes what it computed, because
 * anything that changed since the draft would otherwise be frozen wrong
 * (AC-Y3). Every write that changes a month's pay takes the same row for share
 * first (AC-PY17), so nothing lands between the computation and the freeze.
 *
 * A run pays every contract basis (AC-PY2), overtime by the national rule
 * (AC-PY4), the components that apply to each person (AC-PY5), loans, claims
 * and adjustments (AC-PY8, AC-PY9, AC-PY16), and a leaver's settlement
 * (AC-PY13). A rule a run needs and has no row for blocks it, never pays zero.
 */
@Injectable()
export class PayRunsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payroll: PayrollRepository,
    private readonly records: PayRecordsRepository,
    private readonly items: PayItemsRepository,
    private readonly rules: HrRulesRepository,
    private readonly leaveRows: LeaveRepository,
    private readonly leave: LeaveService,
    private readonly closer: AttendanceCloser,
    private readonly adjustments: PayAdjustmentsService,
    private readonly employees: EmployeesRepository,
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
  async create(ws: ScopedWorkspace, userId: string | null, period: string): Promise<PayRunDetail> {
    const id = await this.createDraft(orgOf(ws), userId, period);
    return this.get(ws, id);
  }

  /** A draft for a month, from the route or the daily job (AC-PY14). Throws 409 when the month has a run. */
  async createDraft(orgId: string, userId: string | null, period: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const computed = await this.compute(tx, orgId, period, null);
      const runId = await this.payroll.insertRun(tx, { orgId, periodStart: firstOfMonth(period), ruleVersions: computed.ruleVersions });
      if (!runId) throw new ConflictException(`There is already a pay run for ${period}.`);
      await this.payroll.upsertPayslips(tx, { orgId, payRunId: runId, status: 'draft', slips: computed.slips });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: runId,
        eventType: 'hr.pay_run_created',
        orgId,
        diff: { period, payslips: computed.slips.length, blockers: computed.blockers.length, automatic: userId === null },
      });
      return runId;
    });
  }

  /** `POST /ops/pay-runs/:id/recompute`: a draft only. */
  async recompute(ws: ScopedWorkspace, userId: string, id: string): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.payroll.findRun(id), ws);
    await this.db.transaction(async (tx) => {
      const run = await this.payroll.lockRun(tx, id);
      if (!run) throw new NotFoundException();
      if (run.status === 'confirmed') throw new ConflictException('A confirmed pay run never changes. Put a correction on a later run.');
      const period = monthOf(run.periodStart);
      const computed = await this.compute(tx, orgId, period, id);
      await this.writeDraft(tx, orgId, id, computed);
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
   * `POST /ops/pay-runs/:id/hold` (AC-PY7): leave a person out of a draft. Their
   * month's earnings become one earning adjustment the next run pays, their
   * installments for the month move a month on, and the draft is computed again
   * without them. Adjustments and claims already waiting simply wait.
   */
  async hold(ws: ScopedWorkspace, userId: string, id: string, body: HoldPayslipRequest): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.payroll.findRun(id), ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    await this.db.transaction(async (tx) => {
      const run = await this.payroll.lockRun(tx, id);
      if (!run) throw new NotFoundException();
      if (run.status === 'confirmed') throw new ConflictException('A confirmed pay run never changes.');
      const period = monthOf(run.periodStart);
      const computed = await this.compute(tx, orgId, period, id);
      const slip = computed.slips.find((s) => s.employeeId === body.employeeId);
      if (!slip) throw new NotFoundException('That person has no payslip in this run.');
      const carried = carriedOnHold(slip.lines);
      // The carried earning is what marks the person held; with nothing earned
      // there is nothing to carry, and what a hold would defer, deferring does.
      if (carried <= 0) {
        throw new ConflictException(`That person earns nothing in ${period}, so there is nothing to hold. Defer the installment instead.`);
      }
      await this.adjustments.forHold(tx, { orgId, employeeId: body.employeeId, payRunId: id, period, grossRwf: carried, reason: body.reason.trim(), userId });
      for (const due of await this.items.installmentsDue([body.employeeId], period, tx)) {
        await this.items.lockLoan(tx, due.loanId);
        const unpaid = (await this.items.schedules([due.loanId], tx)).filter((i) => !i.payslipId);
        for (const move of deferredSchedule(unpaid, period)) {
          await this.items.moveInstallment(tx, move.id, move.to, move.id === due.id ? move.from : null);
        }
      }
      await this.writeDraft(tx, orgId, id, await this.compute(tx, orgId, period, id));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: body.employeeId,
        eventType: 'hr.payslip_held',
        orgId,
        diff: { payRunId: id, period },
        reason: body.reason,
      });
    });
    return this.get(ws, id);
  }

  /**
   * `POST /ops/pay-runs/:id/confirm`. Refused with EVERY blocker listed; a
   * second confirm answers with the same run (AC-Y3). What it freezes it also
   * marks: each installment, claim and adjustment it paid, each loan it paid
   * out or settled, each leaver's paid out leave, and each payslip's snapshot.
   */
  async confirm(ws: ScopedWorkspace, userId: string, id: string): Promise<PayRunDetail> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.payroll.findRun(id), ws);
    await this.db.transaction(async (tx) => {
      const run = await this.payroll.lockRun(tx, id);
      if (!run) throw new NotFoundException();
      if (run.status === 'confirmed') return;
      const period = monthOf(run.periodStart);
      const computed = await this.compute(tx, orgId, period, id);
      if (computed.blockers.length > 0) {
        throw new ConflictException({
          code: 'pay_run_blocked',
          message: `This run cannot be confirmed yet: ${computed.blockers.length} thing${computed.blockers.length === 1 ? '' : 's'} to fix first.`,
          blockers: computed.blockers,
        });
      }
      // What was computed just now is what is frozen, never the draft.
      await this.payroll.dropStaleDrafts(tx, id, computed.slips.map((s) => s.employeeId));
      await this.payroll.upsertPayslips(tx, { orgId, payRunId: id, status: 'confirmed', slips: computed.slips });
      await this.payroll.markComputed(tx, id, computed.ruleVersions);
      await this.payroll.markConfirmed(tx, id, userId);
      await this.markPaid(tx, orgId, id, period, userId, computed);
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
   * AC-Y2, 058-payroll), and what would stop the month being confirmed.
   */
  private async compute(tx: Tx, orgId: string, period: string, runId: string | null): Promise<Computation> {
    const first = firstOfMonth(period);
    const last = lastOfMonth(period);
    const paye = await this.rules.paye(first, tx);
    if (!paye) throw new ConflictException(missingRuleMessage(HR_RULE.paye, first));
    const rssb = await this.rules.rssb(first, tx);
    if (!rssb) throw new ConflictException(missingRuleMessage(HR_RULE.rssb, first));
    const overtimeRule = await this.rules.overtime(first, tx);
    const settlementRule = await this.rules.finalSettlement(first, tx);

    const held = runId ? await this.items.heldIn(runId, tx) : new Set<string>();
    const contracts = (await this.records.contractsWithStructure(orgId, first, last, tx)).filter((c) => !held.has(c.employeeId));
    const byEmployee = new Map<string, typeof contracts>();
    for (const c of contracts) byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), c]);
    const ids = [...byEmployee.keys()];

    const subjects = new Map((await this.records.subjects(ids, tx)).map((s) => [s.employeeId, s]));
    const departments = await this.records.departmentsOf(ids, tx);
    const work = await this.records.workInMonth(ids, first, last, tx);
    const leaveRows = await this.records.leaveInMonth(orgId, first, last, tx);
    const components = await this.items.components(orgId, tx, true);
    const structures = await this.items.structureComponentIds(orgId, tx);
    const targets = await this.items.allTargets(orgId, tx);
    const due = await this.items.installmentsDue(ids, period, tx);
    const payOuts = await this.items.loansToPayOut(ids, first, last, tx);
    const claims = await this.items.claimsPayable(ids, period, tx);
    const open = await this.items.openAdjustments(ids, tx);
    const names = new Map((await this.records.people(ids, tx)).map((p) => [p.employeeId, displayNameOf(p)]));
    const business = await this.records.business(orgId, tx);
    const encashable = (await this.leaveRows.listTypes(orgId, tx, true)).filter((t) => t.encashable && t.yearlyEntitlementDays !== null);

    const blockers: PayRunBlocker[] = [];
    if (!business.rssbEmployerNumber) {
      blockers.push({
        code: 'missing_rssb_employer_number',
        employeeId: null,
        displayName: '',
        message: 'Add the business\'s RSSB employer number in Payroll settings: payslips and the declaration print it.',
      });
    }
    const thresholds = new Map<string | null, number>();
    const thresholdFor = async (propertyId: string | null): Promise<number> => {
      if (!thresholds.has(propertyId)) thresholds.set(propertyId, (await this.closer.rulesFor(orgId, propertyId, tx)).compensationThresholdMinutes);
      return thresholds.get(propertyId) as number;
    };
    let overtimeUsed = false;
    let overtimeMissing = false;
    let settlementUsed = false;
    const settlementLeave = new Map<string, { leaveTypeId: string; days: number; lastDay: string }[]>();
    const loanIds = new Set<string>();
    const slips: (ComputedPayslip & { employeeId: string })[] = [];

    for (const [employeeId, own] of byEmployee) {
      const subject = subjects.get(employeeId);
      if (!subject) continue;
      const name = names.get(employeeId) ?? '';
      const contractOn = (date: string): (typeof own)[number] =>
        own.find((c) => c.startsOn <= date && (c.endsOn === null || c.endsOn >= date)) ?? own[own.length - 1];
      const lastContract = own[own.length - 1];

      // Leave, by contract and by the share pay covers (AC-PY2, AC-PY3).
      const unpaid = new Map<string, number>();
      const partial = new Map<string, Map<number, number>>();
      const paidLeave = new Map<string, Map<number, number>>();
      const add = (map: Map<string, Map<number, number>>, contractId: string, pct: number, days: number): void => {
        const inner = map.get(contractId) ?? new Map<number, number>();
        inner.set(pct, (inner.get(pct) ?? 0) + days);
        map.set(contractId, inner);
      };
      for (const row of leaveRows.filter((r) => r.employeeId === employeeId)) {
        const c = contractOn(row.effectiveOn);
        // `taken` rows are negative and reversals positive, so the days are the negated sum.
        const days = -row.days;
        if (c.wageBasis === 'monthly') {
          if (row.payment === 'unpaid') unpaid.set(c.id, (unpaid.get(c.id) ?? 0) + days);
          else if (row.payment === 'partial') add(partial, c.id, 100 - (row.paymentPercent ?? 0), days);
        } else if (row.payment === 'paid') add(paidLeave, c.id, 100, days);
        else if (row.payment === 'partial') add(paidLeave, c.id, row.paymentPercent ?? 0, days);
      }

      // Attendance, and the overtime approved on it (AC-PY2, AC-PY4).
      const mine = work.filter((w) => w.employeeId === employeeId);
      const workDays = mine.map((w) => ({ workDate: w.workDate, contractId: contractOn(w.workDate).id, workedMinutes: w.workedMinutes }));
      const overtime: { contractId: string; dayKind: DayKind; approvedMinutes: number }[] = [];
      let unknownDay = false;
      for (const w of mine.filter((x) => x.approvedOvertimeMinutes > 0)) {
        if (!w.dayKind) unknownDay = true;
        else overtime.push({ contractId: contractOn(w.workDate).id, dayKind: w.dayKind, approvedMinutes: w.approvedOvertimeMinutes });
      }
      if (unknownDay) {
        blockers.push({
          code: 'overtime_day_unknown',
          employeeId,
          displayName: name,
          message: `${name} has approved overtime on a day whose kind is unknown: record that year's public holidays, then compute again.`,
        });
      }
      if (overtime.length > 0) {
        if (overtimeRule) overtimeUsed = true;
        else if (!overtimeMissing) {
          overtimeMissing = true;
          blockers.push({ code: 'missing_overtime_rule', employeeId: null, displayName: '', message: `${missingRuleMessage(HR_RULE.overtime, first)} Approved overtime is never paid at zero.` });
        }
      }

      // Components that reach this person this month (AC-PY5).
      const conditionSubject: ConditionSubject = {
        sex: subject.sex,
        maritalStatus: subject.maritalStatus,
        childrenCount: subject.childrenCount,
        yearsOfService: fullYears(subject.hiredOn, first),
        priorExperienceYears: subject.priorExperienceYears,
        employeeTypeId: subject.employeeTypeId,
        jobPositionId: subject.jobPositionId,
        departmentIds: departments.get(employeeId) ?? [],
        branchId: subject.workPropertyId,
        wageBasis: lastContract.wageBasis,
      };
      const structureIds = lastContract.payStructureId ? (structures.get(lastContract.payStructureId) ?? new Set<string>()) : new Set<string>();
      const applied = components
        .filter((c) =>
          componentApplies(
            c,
            { subject: conditionSubject, structureComponentIds: structureIds, target: targets.find((t) => t.componentId === c.id && t.employeeId === employeeId)?.mode ?? null },
            period,
          ),
        )
        .map(componentInput);

      // What the caller builds: claims, loans, adjustments and a settlement.
      const extraEarnings: PayslipLine[] = [];
      const extraDeductions: PayslipLine[] = [];
      const passthrough: PayslipLine[] = [];
      for (const claim of claims.filter((c) => c.employeeId === employeeId)) {
        if (claim.kind === 'reimbursement' && claim.amountRwf) {
          passthrough.push({ code: 'reimbursement', label: 'Reimbursement', contractId: null, basis: claim.reason, amountRwf: claim.amountRwf, side: 'passthrough', ref: { kind: 'claim', id: claim.id } });
        } else if (claim.kind === 'leave_encashment' && claim.days) {
          extraEarnings.push({
            code: 'leave_encashment',
            label: `${claim.leaveTypeName ?? 'Leave'} paid out`,
            contractId: lastContract.id,
            basis: `${claim.days} day${claim.days === 1 ? '' : 's'} at the day rate`,
            amountRwf: dayRatePay(lastContract, claim.days),
            side: 'earning',
            taxable: true,
            contributable: false,
            ref: { kind: 'claim', id: claim.id },
          });
        }
      }
      for (const adj of open.filter((a) => a.employeeId === employeeId)) {
        const line: PayslipLine = {
          code: 'adjustment',
          label: adj.reason,
          contractId: null,
          basis: `corrects ${adj.correctsPeriod}`,
          amountRwf: adj.amountRwf,
          side: adj.side === 'earning' ? 'earning' : 'deduction',
          ...(adj.side === 'earning' ? { taxable: adj.taxable, contributable: adj.contributable } : {}),
          ref: { kind: 'adjustment', id: adj.id },
        };
        (adj.side === 'earning' ? extraEarnings : extraDeductions).push(line);
      }
      for (const inst of due.filter((d) => d.employeeId === employeeId)) {
        loanIds.add(inst.loanId);
        extraDeductions.push({
          code: 'loan',
          label: `${inst.kind === 'loan' ? 'Loan' : 'Advance'} repayment, ${inst.number} of ${inst.count}`,
          contractId: null,
          basis: `installment for ${period}${inst.deferredFrom ? `, moved from ${inst.deferredFrom}` : ''}`,
          amountRwf: inst.amountRwf,
          side: 'deduction',
          ref: { kind: 'loan_installment', id: inst.id },
        });
      }
      for (const loan of payOuts.filter((l) => l.employeeId === employeeId)) {
        passthrough.push({
          code: 'loan_paid_out',
          label: loan.kind === 'loan' ? 'Loan paid out' : 'Advance paid out',
          contractId: null,
          basis: `given on ${loan.givenOn}`,
          amountRwf: loan.amountRwf,
          side: 'passthrough',
          ref: { kind: 'loan', id: loan.id },
        });
      }
      // A leaver's settlement (AC-PY13): unused encashable leave and every installment still owed.
      if (subject.offboardedOn && subject.offboardedOn >= first && subject.offboardedOn <= last) {
        for (const inst of await this.items.installmentsAfter([employeeId], period, tx)) {
          loanIds.add(inst.loanId);
          extraDeductions.push({ code: 'loan', label: 'Loan repaid on leaving', contractId: null, basis: `installment for ${inst.period}`, amountRwf: inst.amountRwf, side: 'deduction', ref: { kind: 'loan_installment', id: inst.id } });
        }
        for (const type of encashable) {
          const days = await this.leave.remainingOn({ id: employeeId, orgId, hiredOn: subject.hiredOn, status: subject.status, offboardedOn: subject.offboardedOn }, type, subject.offboardedOn, tx);
          if (days <= 0) continue;
          if (!settlementRule) {
            blockers.push({ code: 'missing_settlement_rule', employeeId, displayName: name, message: `${name} leaves this month with unused ${type.name.toLowerCase()}. ${missingRuleMessage(HR_RULE.finalSettlement, first)}` });
            continue;
          }
          settlementUsed = true;
          extraEarnings.push({
            code: 'settlement_leave',
            label: `Unused ${type.name.toLowerCase()}`,
            contractId: lastContract.id,
            basis: `${days} day${days === 1 ? '' : 's'} at the day rate, on leaving`,
            amountRwf: dayRatePay(lastContract, days),
            side: 'earning',
            taxable: settlementRule.value.unusedLeave.taxable,
            contributable: settlementRule.value.unusedLeave.contributable,
            ref: { kind: 'leave_type', id: type.id },
          });
          settlementLeave.set(employeeId, [...(settlementLeave.get(employeeId) ?? []), { leaveTypeId: type.id, days, lastDay: subject.offboardedOn }]);
        }
      }

      const slip = computePayslip({
        period,
        contracts: own.map((c): PayContract => ({ id: c.id, startsOn: c.startsOn, endsOn: c.endsOn, wageBasis: c.wageBasis, wageRwf: c.wageRwf })),
        unpaidDaysByContract: new Map([...unpaid].map(([k, v]) => [k, Math.max(0, v)])),
        partialLeaveByContract: positive(partial),
        paidLeaveByContract: positive(paidLeave),
        workDays,
        dayThresholdMinutes: await thresholdFor(subject.workPropertyId),
        overtime: overtimeRule ? overtime : [],
        overtimeRule: overtimeRule?.value ?? null,
        childrenCount: subject.childrenCount ?? 0,
        components: applied,
        extraEarnings,
        extraDeductions,
        passthrough,
        paye: paye.value,
        rssb: rssb.value,
      });
      if (slip.netRwf < 0) {
        const remedies: PayRunRemedy[] = [];
        if (due.some((d) => d.employeeId === employeeId)) remedies.push('defer_installment');
        if (open.some((a) => a.employeeId === employeeId && a.side === 'deduction')) remedies.push('waive_adjustment');
        if (carriedOnHold(slip.lines) > 0) remedies.push('hold_payslip');
        blockers.push({
          code: 'negative_net',
          employeeId,
          displayName: name,
          message: `${name} would be paid ${slip.netRwf} RWF. ${remedyWords(remedies)}`,
          remedies,
        });
      }
      slips.push({ employeeId, ...slip });
    }

    const ruleVersions: PayRunRuleVersion[] = [
      { configType: HR_RULE.paye, configEntryId: paye.configEntryId, version: paye.version },
      { configType: HR_RULE.rssb, configEntryId: rssb.configEntryId, version: rssb.version },
    ];
    if (overtimeUsed && overtimeRule) ruleVersions.push({ configType: HR_RULE.overtime, configEntryId: overtimeRule.configEntryId, version: overtimeRule.version });
    if (settlementUsed && settlementRule) {
      ruleVersions.push({ configType: HR_RULE.finalSettlement, configEntryId: settlementRule.configEntryId, version: settlementRule.version });
    }
    return {
      slips,
      ruleVersions,
      blockers: [...blockers, ...(await this.blockers(tx, ids, first, last))],
      settlementLeave,
      loanIds: [...loanIds],
    };
  }

  private async writeDraft(tx: Tx, orgId: string, id: string, computed: Computation): Promise<void> {
    await this.payroll.upsertPayslips(tx, { orgId, payRunId: id, status: 'draft', slips: computed.slips });
    await this.payroll.dropStaleDrafts(tx, id, computed.slips.map((s) => s.employeeId));
    await this.payroll.markComputed(tx, id, computed.ruleVersions);
  }

  /** At confirm: mark what the run paid, zero a leaver's paid out leave, freeze each snapshot (AC-PY8 to AC-PY13). */
  private async markPaid(tx: Tx, orgId: string, runId: string, period: string, userId: string, computed: Computation): Promise<void> {
    const frozen = new Map((await this.payroll.payslips(runId, tx)).map((p) => [p.employeeId, p.id]));
    for (const slip of computed.slips) {
      const payslipId = frozen.get(slip.employeeId);
      if (!payslipId) continue;
      for (const line of slip.lines) {
        if (!line.ref) continue;
        if (line.ref.kind === 'loan_installment') await this.items.markInstallmentPaid(tx, line.ref.id, payslipId);
        else if (line.ref.kind === 'loan') await this.items.markLoanPaidOut(tx, line.ref.id, payslipId);
        else if (line.ref.kind === 'claim') await this.items.markClaimPaid(tx, line.ref.id, payslipId);
        else if (line.ref.kind === 'adjustment') await this.items.markAdjustmentPaid(tx, line.ref.id, payslipId);
      }
    }
    await this.items.settleFullyPaid(tx, computed.loanIds);
    for (const [employeeId, rows] of computed.settlementLeave) {
      const employee = await this.employees.find(employeeId, tx);
      if (!employee) continue;
      for (const r of rows) {
        const type = await this.leaveRows.findType(r.leaveTypeId, tx);
        if (type) await this.leave.encash(tx, employee, type, r.days, userId, 'Paid out on leaving', r.lastDay);
      }
    }
    // Claims still waiting for this month are paid by the next one (AC-PY9).
    await this.items.moveUnpaidClaims(tx, orgId, period, nextPeriod(period));
    const business = await this.records.business(orgId, tx);
    const ids = computed.slips.map((s) => s.employeeId);
    const people = new Map((await this.records.people(ids, tx)).map((p) => [p.employeeId, p]));
    const accounts = await this.records.primaryAccounts(ids, tx);
    const today = kigaliToday();
    for (const slip of computed.slips) {
      const payslipId = frozen.get(slip.employeeId);
      const person = people.get(slip.employeeId);
      if (!payslipId || !person) continue;
      await this.records.setSnapshot(tx, payslipId, {
        businessName: business.name,
        tin: business.tin,
        rssbEmployerNumber: business.rssbEmployerNumber,
        personName: displayNameOf(person),
        employeeNumber: person.employeeNumber,
        jobPosition: person.jobPositionTitle,
        rssbNumber: person.rssbNumber,
        idNumber: person.idDocumentNumber,
        payAccount: maskAccount(accounts.get(slip.employeeId) ?? null),
        confirmedOn: today,
      });
      await writeHrEvent(tx, {
        trigger: 'payslip.confirmed',
        aggregateType: 'payslip',
        aggregateId: payslipId,
        change: 'confirmed',
        workspaceId: null,
        payload: { payslipId, employeeId: slip.employeeId, payRunId: runId },
      });
    }
  }

  /** Everything that would make a frozen month wrong, for every person (AC-Y3). */
  private async blockers(tx: Tx, employeeIds: string[], first: string, last: string): Promise<PayRunBlocker[]> {
    const people = await this.payroll.coveredPeople(employeeIds, tx);
    const names = new Map(people.map((p) => [p.employeeId, displayNameOf(p)]));
    const out: PayRunBlocker[] = [];
    for (const p of people) {
      const name = names.get(p.employeeId) ?? '';
      if (!p.rssbNumber) {
        out.push({ code: 'missing_rssb_number', employeeId: p.employeeId, displayName: name, message: `${name} has no RSSB number on file.` });
      }
      if (!p.idDocumentType || !p.idDocumentNumber) {
        out.push({ code: 'missing_id', employeeId: p.employeeId, displayName: name, message: `${name} has no ID on file.` });
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
      try {
        blockers = (await this.db.transaction((tx) => this.compute(tx, run.orgId, period, run.id))).blockers;
      } catch {
        // A rule removed since the draft was made: the person checks still say what they can.
        blockers = await this.db.transaction((tx) => this.blockers(tx, slips.map((s) => s.employeeId), firstOfMonth(period), lastOfMonth(period)));
      }
    }
    return { run: presentRun(run), payslips: slips.map(presentPayslip), blockers };
  }
}

function positive(map: Map<string, Map<number, number>>): Map<string, Map<number, number>> {
  return new Map([...map].map(([k, inner]) => [k, new Map([...inner].filter(([, d]) => d > 0))]));
}

/**
 * What a hold carries to next month (AC-PY7): the month's own earnings, not an
 * adjustment or an encashment already waiting, which simply wait again.
 */
function carriedOnHold(lines: readonly Pick<PayslipLine, 'side' | 'code' | 'amountRwf'>[]): number {
  return lines
    .filter((l) => l.side === 'earning' && l.code !== 'adjustment' && l.code !== 'leave_encashment')
    .reduce((s, l) => s + l.amountRwf, 0);
}

/** The negative net blocker's advice, naming only the remedies this payslip has. */
function remedyWords(remedies: readonly PayRunRemedy[]): string {
  const words: Record<PayRunRemedy, string> = {
    defer_installment: 'defer an installment',
    waive_adjustment: 'waive a deduction',
    hold_payslip: 'hold the payslip to next month',
  };
  if (remedies.length === 0) return 'Correct what it deducts before confirming.';
  const said = remedies.map((r) => words[r]);
  const sentence = said.length === 1 ? said[0] : `${said.slice(0, -1).join(', ')} or ${said[said.length - 1]}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function componentInput(c: ComponentRow): PayComponentInput {
  return {
    code: c.code,
    name: c.name,
    kind: c.kind,
    amountType: c.amountType,
    amountRwf: c.amountRwf,
    rate: c.rate,
    capRwf: c.capRwf,
    taxable: c.kind === 'allowance' ? c.taxable : true,
    contributable: c.inContributionBase,
    beforeTax: c.kind === 'deduction' && c.beforeTax,
  };
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

export function presentPayslip(row: PayslipRow): Payslip {
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
    nonIncomeRwf: row.nonIncomeRwf,
    netRwf: row.netRwf,
    lines: row.lines,
    status: row.status,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidMethod: row.paidMethod,
    paidReference: row.paidReference,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  };
}
