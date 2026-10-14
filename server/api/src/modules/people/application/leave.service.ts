import {
  effectivePermissionsForRole,
  type BulkResponse,
  type CreateLeaveRequestRequest,
  type CreateMyLeaveRequestRequest,
  type LeaveBalancePage,
  type LeaveBalances,
  type LeaveBulkRequest,
  type LeaveDashboard,
  type LeaveLot,
  type LeaveRequest,
  type LeaveRequestPage,
  type LeaveType,
  type ListIds,
  type ListQuery,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { runBulk } from '../../../shared/lists/bulk';
import { pageOf } from '../../../shared/lists/list-query';
import { isCalendarDate } from '../../booking/domain/pricing';
import { addDays, eachDate, kigaliToday, mondayOf, monthOf } from '../domain/hr-calendar';
import { HR_RULE, missingRuleMessage } from '../domain/hr-rules';
import { dueAccruals } from '../domain/leave-accrual';
import {
  countLeaveDays,
  isContradictoryHalfDay,
  yearsTouched,
  type LeaveCount,
  type LeaveRange,
} from '../domain/leave-days';
import {
  drawLots,
  eligibilityRefusal,
  lotStates,
  planLotEvents,
  restrictionFor,
  tenth,
  validOn,
  type LedgerItem,
} from '../domain/leave-lots';
import { isOrgHoliday, isWeeklyOff, weeklyOffsFor } from '../domain/time-rules';
import { EmployeesRepository, violatedConstraint, type EmployeeRow, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { LeaveExtraRepository } from '../infrastructure/leave-extra.repository';
import {
  LeaveRepository,
  type ApprovalRow,
  type LeaveRequestRow,
  type LeaveTypeRow,
  type LedgerRow,
} from '../infrastructure/leave.repository';
import { TimeRepository } from '../infrastructure/time.repository';
import { TimeSettingsRepository } from '../infrastructure/time-settings.repository';
import { rosterCard } from './employee-presenter';
import { HrFilesService } from './hr-files.service';
import { PayAdjustmentsService, sharesByPeriod } from './pay-adjustments.service';
import { assertPersonInReach, orgOf } from './hr-access';

/** How far back self service may start a type that allows past dates, such as sick leave (AC-LV6). */
const PAST_DAYS_ALLOWED = 30;

/** Who asks for leave, and how: the office for someone, or the person through self service. */
export interface LeaveActor {
  orgId: string;
  workspaceId: string | null;
  userId: string;
  selfService: boolean;
  /** The office side: does the caller hold `leave.approve`? Past dates need it (AC-LV6). */
  mayDecide: boolean;
}

/**
 * Leave (ADR-058, the first thread and 058-leave): types, balances, requests and
 * decisions.
 *
 * A balance is only ever the sum of the ledger, and every credit is a lot that
 * a debit names (`domain/leave-lots.ts`). Leave writes for one person run under
 * a lock on their file row, so two requests that together overdraw a balance,
 * or two decisions of one request, cannot both pass. Days are estimated at
 * request and counted again at the final step, because the roster can move in
 * between. A request copies its type's steps and pay terms as it is made, so
 * an edit to the type never rewrites it.
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly leave: LeaveRepository,
    private readonly extra: LeaveExtraRepository,
    private readonly time: TimeRepository,
    private readonly rules: HrRulesRepository,
    private readonly settings: TimeSettingsRepository,
    private readonly files: HrFilesService,
    private readonly payAdjustments: PayAdjustmentsService,
  ) {}

  // --- Types, accrual and lots ---------------------------------------------------------

  /**
   * The business's active leave types, created from the defaults row in force
   * the first time anything asks (AC-L1). A missing row is refused, never guessed.
   */
  async ensureTypes(orgId: string): Promise<LeaveTypeRow[]> {
    const existing = await this.leave.listTypes(orgId);
    if (existing.length > 0) return existing;
    const all = await this.leave.listTypes(orgId, undefined, true);
    if (all.length > 0) return existing;
    const today = kigaliToday();
    const defaults = await this.rules.leaveDefaults(today);
    if (!defaults) throw new ConflictException(missingRuleMessage(HR_RULE.leaveDefaults, today));
    await this.leave.createTypesFromDefaults(orgId, defaults);
    return this.leave.listTypes(orgId);
  }

  /**
   * Write whatever this person is owed and whatever has lapsed, up to today
   * (AC-L2, AC-LV2, AC-LV3): the accruals, then each type's year ends, month
   * ends and lot expiries in date order. The daily job is what normally does
   * this; it also runs here before any balance is read or checked, so a
   * balance never depends on whether the worker ran this morning. Every row is
   * guarded by its own unique index, so writing it twice is impossible.
   */
  async catchUpAccruals(
    employee: Pick<EmployeeRow, 'id' | 'orgId' | 'hiredOn' | 'status' | 'offboardedOn'>,
    types: readonly LeaveTypeRow[],
    tx?: Tx,
  ): Promise<number> {
    const today = kigaliToday();
    const through = employee.status === 'offboarded' && employee.offboardedOn && employee.offboardedOn < today ? employee.offboardedOn : today;
    let written = await this.leave.insertAccruals(
      types.flatMap((type) =>
        dueAccruals({ type, hiredOn: employee.hiredOn, through }).map((a) => ({
          orgId: employee.orgId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          days: a.days,
          effectiveOn: a.effectiveOn,
          periodKey: a.periodKey,
        })),
      ),
      tx,
    );
    for (const type of types) {
      if (type.yearlyEntitlementDays === null) continue;
      const base = { orgId: employee.orgId, employeeId: employee.id, leaveTypeId: type.id };
      const write = async (t: Tx): Promise<number> => {
        const plan = planLotEvents(await this.leave.ledgerOf(employee.id, type.id, t), type, today);
        return plan.length === 0 ? 0 : this.leave.insertPlanned(t, base, plan);
      };
      if (tx) {
        written += await write(tx);
        continue;
      }
      // Planned outside a transaction first, because nearly every read finds
      // nothing to write; only then under the file's lock, planned again there,
      // so two reads at once cannot both carry the same year.
      if (planLotEvents(await this.leave.ledgerOf(employee.id, type.id), type, today).length === 0) continue;
      written += (await this.employees.withEmployeeLock(employee.id, write)) ?? 0;
    }
    return written;
  }

  /**
   * The days available for a leave starting on `date` (AC-LV4a): the lots valid
   * then, after every year end and expiry between now and then, plus the
   * accrual the person will have earned by then, computed and not written.
   */
  async availableOn(employee: Pick<EmployeeRow, 'id' | 'hiredOn'>, type: LeaveTypeRow, date: string, tx?: Tx): Promise<number> {
    const items: LedgerItem[] = await this.leave.ledgerOf(employee.id, type.id, tx);
    const written = new Set(items.filter((i) => i.kind === 'accrual').map((i) => i.periodKey));
    const projected: LedgerItem[] = dueAccruals({ type, hiredOn: employee.hiredOn, through: date })
      .filter((a) => !written.has(a.periodKey))
      .map((a, i) => ({ id: `projected:${i}`, kind: 'accrual', days: a.days, effectiveOn: a.effectiveOn, lotId: null, expiresOn: null, reversesId: null, periodKey: a.periodKey }));
    const simulated = [...items, ...projected];
    const planned = planLotEvents(simulated, type, date).map(
      (p): LedgerItem => ({ id: p.ref, kind: p.kind, days: p.days, effectiveOn: p.effectiveOn, lotId: p.lotId ?? p.lotRef, expiresOn: p.expiresOn, reversesId: null, periodKey: p.periodKey }),
    );
    return tenth(
      lotStates([...simulated, ...planned], type.reset)
        .filter((l) => validOn(l, date))
        .reduce((sum, l) => sum + l.remaining, 0),
    );
  }

  // --- Reads ---------------------------------------------------------------

  /** `GET /ops/employees/:id/leave-balances`: each type's sum, its lots and its rows. */
  async balances(ws: ScopedWorkspace, employeeId: string): Promise<LeaveBalances> {
    const employee = assertOwnedByOrg(await this.employees.find(employeeId), ws);
    assertInBranchScope(ws, employee.workPropertyId);
    return this.balancesOf(employee);
  }

  /** One person's balances, for the office and for self service alike. */
  async balancesOf(employee: EmployeeRow): Promise<LeaveBalances> {
    const types = await this.ensureTypes(employee.orgId);
    await this.catchUpAccruals(employee, types);
    const ledger = await this.leave.ledger(employee.id);
    const today = kigaliToday();
    return {
      employeeId: employee.id,
      balances: types.map((type) => {
        const entries = ledger.filter((e) => e.leaveTypeId === type.id);
        const keepsBalance = type.yearlyEntitlementDays !== null;
        return {
          leaveType: presentType(type),
          balanceDays: keepsBalance ? tenth(entries.reduce((s, e) => s + e.days, 0)) : null,
          lots: keepsBalance ? presentLots(entries, type, today) : [],
          entries: entries.map(presentEntry),
        };
      }),
    };
  }

  /**
   * `GET /ops/leave/balances` (AC-LV13): a row per person, the sum of each
   * type's ledger. Each person on the page is caught up first, as any balance
   * read is.
   */
  async balanceList(ws: ScopedWorkspace, query: ListQuery): Promise<LeaveBalancePage> {
    const orgId = orgOf(ws);
    const types = await this.ensureTypes(orgId);
    const page = await this.leave.balancePeoplePage({ orgId, scope: ws.branchScope, query });
    for (const person of page.rows) await this.catchUpAccruals(person, types);
    const ledger = await this.leave.ledgerOfMany(page.rows.map((p) => p.id));
    return pageOf(
      page.rows.map((p) => ({
        employee: rosterCard({ id: p.id, preferredName: p.preferredName, legalName: p.legalName, jobPositionTitle: p.jobPositionTitle }),
        branchId: p.workPropertyId,
        jobPositionId: p.jobPositionId,
        balances: types.map((type) => ({
          leaveTypeId: type.id,
          days:
            type.yearlyEntitlementDays === null
              ? null
              : tenth(ledger.filter((e) => e.employeeId === p.id && e.leaveTypeId === type.id).reduce((s, e) => s + e.days, 0)),
        })),
      })),
      page.total,
      query,
      { groups: page.groups, statusCounts: page.statusCounts },
    );
  }

  /** `GET /ops/leave/dashboard` (AC-LV13): who is off today, who starts this week, what waits. */
  async dashboard(ws: ScopedWorkspace, userId: string): Promise<LeaveDashboard> {
    const orgId = orgOf(ws);
    const today = kigaliToday();
    const weekEnd = addDays(mondayOf(today), 6);
    const me = await this.employees.findForUser(orgId, userId);
    const [overlapping, waiting, allocations] = await Promise.all([
      this.leave.approvedOverlapping(orgId, ws.branchScope, today, weekEnd),
      this.leave.waitingCounts(orgId, ws.branchScope, me),
      this.extra.waitingAllocations(orgId, ws.branchScope),
    ]);
    const card = (r: LeaveRequestRow): LeaveDashboard['onLeaveToday'][number] => ({
      requestId: r.id,
      employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
      leaveTypeName: r.leaveTypeName,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
    });
    return {
      today,
      onLeaveToday: overlapping.filter((r) => r.startsOn <= today && r.endsOn >= today).map(card),
      startingThisWeek: overlapping.filter((r) => r.startsOn > today && r.startsOn <= weekEnd).map(card),
      waiting: { ...waiting, allocations },
    };
  }

  /** `GET /ops/leave/requests`: one page of the queue; by default what is routed to the caller comes first. */
  async list(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<LeaveRequestPage> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    const page = await this.leave.listRequestsPage({ orgId, scope: ws.branchScope, query, me });
    const approvals = await this.leave.approvalsOf(page.rows.map((r) => r.id));
    return pageOf(page.rows.map((r) => presentRequest(r, me, approvals)), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  /** `GET /ops/leave/requests/ids`: select all over the queue, up to the bulk cap (AC-LF15). */
  async ids(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ListIds> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    return this.leave.listRequestIds({ orgId, scope: ws.branchScope, query, me });
  }

  /** `POST /ops/leave/requests/bulk`: each id decided as the single command, at its own step (AC-LF6). */
  bulk(ws: ScopedWorkspace, userId: string, body: LeaveBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) => (body.action === 'approve' ? this.approve(ws, userId, id, note) : this.reject(ws, userId, id, note)));
  }

  /** A request's attachment as a five minute link: its deciders, `people.manage` and the person (058-leave, security model). */
  async attachmentLink(ws: ScopedWorkspace, id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const request = assertOwnedByOrg(await this.leave.findRequest(id), ws);
    assertInBranchScope(ws, request.workPropertyId);
    if (!request.attachmentKey) throw new NotFoundException('This request has no attachment.');
    return { url: await this.files.link(request.attachmentKey), expiresInSeconds: 300 };
  }

  // --- Request -------------------------------------------------------------

  /** `POST /ops/leave/requests`: file leave for someone, with estimated days. */
  async request(ws: ScopedWorkspace, userId: string, body: CreateLeaveRequestRequest): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const { employeeId: _ignored, ...ask } = body;
    void _ignored;
    const id = await this.requestFor(
      { orgId, workspaceId: ws.workspaceId, userId, selfService: false, mayDecide: ws.permissions.includes('leave.approve') },
      employee,
      ask,
    );
    return this.presentById(id, orgId, userId);
  }

  /**
   * Ask for leave for a person (AC-LV6, AC-LV9, AC-LV4a), from the office or
   * from self service, and answer the request's id. A type with no approval
   * steps is approved in the same transaction.
   */
  async requestFor(actor: LeaveActor, employee: EmployeeRow, ask: CreateMyLeaveRequestRequest): Promise<string> {
    if (employee.status !== 'active') {
      throw new ConflictException(`${employee.legalName} has left, so no leave can be requested for them.`);
    }
    const types = await this.ensureTypes(actor.orgId);
    const type = types.find((t) => t.id === ask.leaveTypeId);
    if (!type) throw new NotFoundException('That leave type is not available here.');
    const range: LeaveRange = { startsOn: ask.startsOn, endsOn: ask.endsOn, startHalf: ask.startHalf ?? 'full', endHalf: ask.endHalf ?? 'full' };
    assertRange(range);
    if (range.startsOn < employee.hiredOn) {
      throw new UnprocessableEntityException(`${employee.legalName} starts work on ${employee.hiredOn}, so leave cannot begin before that.`);
    }
    const today = kigaliToday();
    if (range.startsOn < today) {
      if (actor.selfService) {
        if (!type.allowsPastRequests) throw new UnprocessableEntityException(`${type.name} cannot start in the past. Ask the office.`);
        if (range.startsOn < addDays(today, -PAST_DAYS_ALLOWED)) {
          throw new UnprocessableEntityException(`${type.name} can start at most ${PAST_DAYS_ALLOWED} days back.`);
        }
      } else if (!actor.mayDecide) {
        throw new ForbiddenException('Leave that has already started is filed by someone who decides leave.');
      }
    }
    if (employee.offboardedOn && range.endsOn > employee.offboardedOn) {
      throw new UnprocessableEntityException('That leave runs past their last day.');
    }
    const refusal = eligibilityRefusal(
      type,
      { sex: employee.sex, serviceFrom: employee.serviceFrom },
      range.startsOn,
      type.oncePerEmployment ? await this.leave.takenBefore(employee.id, type.id) : false,
    );
    if (refusal) throw new UnprocessableEntityException(refusal);
    const attachmentKey = ask.attachmentKey?.trim() || null;
    if (type.needsAttachment && !attachmentKey) {
      throw new UnprocessableEntityException(`${type.name} needs an attachment, such as a doctor's note.`);
    }
    if (attachmentKey) {
      if (!actor.workspaceId) throw new UnprocessableEntityException('A file is not one uploaded here for this.');
      await this.files.assertOwn({ workspaceId: actor.workspaceId }, 'attachment', [attachmentKey]);
    }
    await this.assertNotRestricted(actor.orgId, employee, type, range);

    let approvedAtRequest = false;
    const created = await this.employees.withEmployeeLock(employee.id, async (tx, locked) => {
      await this.catchUpAccruals(locked, types, tx);
      const count = await this.count(locked.id, range, type, tx);
      if (count.days <= 0) {
        throw new UnprocessableEntityException('Those dates hold no working day, so there is nothing to take.');
      }
      if (type.yearlyEntitlementDays !== null) {
        const available = tenth((await this.availableOn(locked, type, range.startsOn, tx)) - (await this.leave.pendingDays(locked.id, type.id, null, tx)));
        if (count.days > available) {
          throw new ConflictException(
            `${locked.legalName} will have ${fmt(available)} day${available === 1 ? '' : 's'} of ${type.name.toLowerCase()} left by ${range.startsOn}, after what is already asked for, and this asks for ${fmt(count.days)}.`,
          );
        }
      }
      let id: string;
      try {
        id = await this.leave.insertRequest(tx, {
          orgId: actor.orgId,
          employeeId: locked.id,
          leaveTypeId: type.id,
          startsOn: range.startsOn,
          endsOn: range.endsOn,
          startHalf: range.startHalf,
          endHalf: range.endHalf,
          days: count.days,
          reason: ask.reason?.trim() || null,
          routedToEmployeeId: locked.reportingManagerId,
          requestedByUserId: actor.userId,
          payment: type.payment,
          paymentPercent: type.paymentPercent,
          approvalSteps: type.approvalSteps,
          attachmentKey,
        });
      } catch (error) {
        if (violatedConstraint(error, '23P01') === 'leave_requests_no_overlap') {
          throw new ConflictException('These dates overlap leave this person already has requested or approved.');
        }
        throw error;
      }
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: locked.id,
        eventType: 'hr.leave_requested',
        orgId: actor.orgId,
        diff: { leaveRequestId: id, leaveType: type.code, startsOn: range.startsOn, endsOn: range.endsOn, days: count.days, selfService: actor.selfService },
      });
      if (type.approvalSteps === 0) {
        // No step at all: approved as it is asked (AC-LV7).
        const current = await this.leave.findRequest(id, tx);
        if (!current) throw new NotFoundException();
        await this.finalApprove(tx, locked, current, type, actor.userId, null, actor.workspaceId);
        approvedAtRequest = true;
      } else {
        await writeHrEvent(tx, {
          trigger: 'leave.requested',
          aggregateType: 'leave_request',
          aggregateId: id,
          change: 'requested',
          workspaceId: actor.workspaceId,
          payload: { leaveRequestId: id, employeeId: locked.id },
        });
      }
      return id;
    });
    if (!created) throw new NotFoundException();
    void approvedAtRequest;
    return created;
  }

  // --- Decisions -----------------------------------------------------------

  /**
   * `POST /ops/leave/requests/:id/approve`, at the step the request is at
   * (AC-LV7). Step 1 of two moves it to step 2, unless nobody else at the
   * branch can decide leave, when step 2 is recorded as skipped and step 1
   * decides. Step 2 needs someone other than whoever decided step 1. Only the
   * final step counts the days, checks the balance and writes the ledger.
   */
  async approve(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const types = await this.leave.listTypes(orgId, undefined, true);
    const type = types.find((t) => t.id === request.leaveTypeId);
    if (!type) throw new NotFoundException();

    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const current = await this.leave.findRequest(id, tx);
      if (!current || current.status !== 'requested') {
        throw new ConflictException(`That request is ${current?.status ?? 'gone'} now, so it cannot be approved.`);
      }
      const approvals = await this.leave.approvalsOf([id], tx);
      if (current.approvalSteps === 2 && current.currentStep === 1) {
        await this.leave.insertApproval(tx, { orgId, requestId: id, step: 1, decision: 'approved', decidedByUserId: userId, note });
        const anotherDecider = await this.anotherDecider(orgId, employee.workPropertyId, [userId, employee.membershipUserId], tx);
        if (anotherDecider) {
          if (!(await this.leave.advanceStep(tx, id))) throw new ConflictException('Someone decided that request a moment ago.');
          await writeHrAudit(tx, {
            actorUserId: userId,
            subjectType: 'employee',
            subjectId: employee.id,
            eventType: 'hr.leave_step1_approved',
            orgId,
            diff: { leaveRequestId: id },
            reason: note,
          });
          await writeHrEvent(tx, {
            trigger: 'leave.step2_pending',
            aggregateType: 'leave_request',
            aggregateId: id,
            change: 'step2',
            workspaceId: ws.workspaceId,
            payload: { leaveRequestId: id, employeeId: employee.id },
          });
          return true;
        }
        await this.leave.insertApproval(tx, {
          orgId,
          requestId: id,
          step: 2,
          decision: 'skipped',
          decidedByUserId: null,
          note: 'Nobody else at this branch decides leave, so the first step decides.',
        });
      } else if (current.approvalSteps === 2 && current.currentStep === 2) {
        const first = approvals.find((a) => a.step === 1);
        if (first?.decidedByUserId === userId) {
          throw new ForbiddenException('The second step needs someone other than whoever approved the first.');
        }
        await this.leave.insertApproval(tx, { orgId, requestId: id, step: 2, decision: 'approved', decidedByUserId: userId, note });
      } else {
        await this.leave.insertApproval(tx, { orgId, requestId: id, step: 1, decision: 'approved', decidedByUserId: userId, note });
      }
      await this.assertNotRestricted(orgId, employee, type, current, tx);
      await this.finalApprove(tx, employee, current, type, userId, note, ws.workspaceId);
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, orgId, userId);
  }

  /**
   * The final step (AC-L4, AC-LV4): count the days again, check what is
   * available on the first day, refuse unpaid days in a month whose pay is
   * confirmed, then write one `taken` row per calendar month and per lot drawn,
   * and take the person off their shifts in the range.
   */
  private async finalApprove(
    tx: Tx,
    employee: EmployeeRow,
    current: LeaveRequestRow,
    type: LeaveTypeRow,
    userId: string,
    note: string | null,
    workspaceId: string | null,
  ): Promise<void> {
    const types = await this.leave.listTypes(employee.orgId, tx);
    await this.catchUpAccruals(employee, types, tx);
    const count = await this.count(employee.id, current, type, tx);
    if (count.days <= 0) throw new ConflictException('Those dates hold no working day any more. Refuse the request instead.');
    if (type.yearlyEntitlementDays !== null) {
      const available = tenth((await this.availableOn(employee, type, current.startsOn, tx)) - (await this.leave.pendingDays(employee.id, type.id, current.id, tx)));
      if (count.days > available) {
        throw new ConflictException(
          `${employee.legalName} will have ${fmt(available)} day${available === 1 ? '' : 's'} of ${type.name.toLowerCase()} left by ${current.startsOn}, and this takes ${fmt(count.days)}.`,
        );
      }
    }
    // Unpaid days landing in a month whose pay is confirmed become a pay
    // adjustment on the next run, in this transaction (AC-LV9a).
    await this.payAdjustments.forLeave(tx, {
      employee,
      requestId: current.id,
      payment: current.payment,
      paymentPercent: current.paymentPercent,
      byMonth: count.byMonth.map((share) => ({ period: share.period, days: share.days })),
      direction: 'approve',
      userId,
    });
    const moved = await this.leave.decide(tx, { id: current.id, from: 'requested', to: 'approved', userId, note, days: count.days });
    if (!moved) throw new ConflictException('Someone decided that request a moment ago.');

    const working: LedgerItem[] = type.yearlyEntitlementDays === null ? [] : await this.leave.ledgerOf(employee.id, type.id, tx);
    const rows = count.byMonth.flatMap((share, i) => {
      const draws = type.yearlyEntitlementDays === null ? [{ lotId: null, days: share.days }] : drawLots(working, type.reset, share.effectiveOn, share.days);
      return draws.map((d, j) => {
        working.push({ id: `drawn:${i}:${j}`, kind: 'taken', days: -d.days, effectiveOn: share.effectiveOn, lotId: d.lotId, expiresOn: null, reversesId: null, periodKey: null });
        return {
          orgId: employee.orgId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          kind: 'taken' as const,
          days: -d.days,
          effectiveOn: share.effectiveOn,
          leaveRequestId: current.id,
          lotId: d.lotId,
          createdByUserId: userId,
        };
      });
    });
    await this.leave.insertLedger(tx, rows);
    const cancelled = await this.time.cancelScheduledBetween(tx, employee.id, current.startsOn, current.endsOn, 'On approved leave');
    await writeHrAudit(tx, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: employee.id,
      eventType: 'hr.leave_approved',
      orgId: employee.orgId,
      diff: { leaveRequestId: current.id, days: count.days, shiftsCancelled: cancelled },
      reason: note,
    });
    await writeHrEvent(tx, {
      trigger: 'leave.decided',
      aggregateType: 'leave_request',
      aggregateId: current.id,
      change: 'approved',
      workspaceId,
      payload: { leaveRequestId: current.id, employeeId: employee.id },
    });
  }

  /** `POST /ops/leave/requests/:id/reject`, at whichever step it waits: rejection at either ends it (AC-LV7). */
  async reject(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const current = await this.leave.findRequest(id, tx);
      if (!current || current.status !== 'requested') throw new ConflictException('That request is no longer waiting for a decision.');
      if (current.currentStep === 2) {
        const first = (await this.leave.approvalsOf([id], tx)).find((a) => a.step === 1);
        if (first?.decidedByUserId === userId) {
          throw new ForbiddenException('The second step needs someone other than whoever approved the first.');
        }
      }
      const moved = await this.leave.decide(tx, { id, from: 'requested', to: 'rejected', userId, note });
      if (!moved) throw new ConflictException('That request is no longer waiting for a decision.');
      await this.leave.insertApproval(tx, { orgId, requestId: id, step: current.currentStep, decision: 'rejected', decidedByUserId: userId, note });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_rejected',
        orgId,
        diff: { leaveRequestId: id, step: current.currentStep },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'leave.decided',
        aggregateType: 'leave_request',
        aggregateId: id,
        change: 'rejected',
        workspaceId: ws.workspaceId,
        payload: { leaveRequestId: id, employeeId: employee.id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, orgId, userId);
  }

  /**
   * `POST /ops/leave/requests/:id/cancel`. A waiting request is simply
   * cancelled; an approved one writes one `reversal` per `taken` row, naming
   * the same lot, so the days go back where they came from (AC-L5, AC-LV4).
   */
  async cancel(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    await this.cancelFor({ orgId, userId }, request.employeeId, id, note);
    return this.presentById(id, orgId, userId);
  }

  /** Cancel a request: the office's, and the person's own while it still waits (AC-SS6). */
  async cancelFor(actor: { orgId: string; userId: string }, employeeId: string, id: string, note: string | null, onlyWaiting = false): Promise<void> {
    const done = await this.employees.withEmployeeLock(employeeId, async (tx, employee) => {
      const current = await this.leave.findRequest(id, tx);
      if (!current || current.employeeId !== employeeId) throw new NotFoundException();
      if (current.status !== 'requested' && (onlyWaiting || current.status !== 'approved')) {
        throw new ConflictException(`That request is ${current.status}, so there is nothing to cancel${onlyWaiting ? ' here' : ''}.`);
      }
      if (current.status === 'approved') {
        // What was taken in a confirmed month is given back on the next run (AC-LV9a).
        const taken = await this.leave.unreversedTaken(current.id, tx);
        await this.payAdjustments.forLeave(tx, {
          employee,
          requestId: current.id,
          payment: current.payment,
          paymentPercent: current.paymentPercent,
          byMonth: sharesByPeriod(taken.map((t) => ({ effectiveOn: t.effectiveOn, days: -t.days }))),
          direction: 'cancel',
          userId: actor.userId,
        });
      }
      const moved = await this.leave.decide(tx, { id, from: current.status, to: 'cancelled', userId: actor.userId, note });
      if (!moved) throw new ConflictException('Someone decided that request a moment ago.');
      const reversed = current.status === 'approved' ? await this.reverseTaken(tx, current, actor.userId, 'Leave cancelled') : 0;
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_cancelled',
        orgId: actor.orgId,
        diff: { leaveRequestId: id, from: current.status, reversedRows: reversed },
        reason: note,
      });
      return true;
    });
    if (!done) throw new NotFoundException();
  }

  // --- Offboarding (AC-O1) -------------------------------------------------

  /**
   * Leave after a person's last day, inside the offboarding transaction: a
   * waiting request is cancelled; an approved one starting after the last day is
   * cancelled and reversed; one spanning the last day keeps its days up to it
   * and has the rest reversed. Counted BEFORE their shifts come off the roster,
   * because the count reads the roster.
   */
  async closeAfterLastDay(tx: Tx, employee: EmployeeRow, lastDay: string, userId: string): Promise<{ cancelled: number; reversed: number }> {
    const open = await this.leave.openEndingAfter(employee.id, lastDay, tx);
    let cancelled = 0;
    let reversed = 0;
    for (const request of open) {
      if (request.status === 'requested' || request.startsOn > lastDay) {
        await this.leave.decide(tx, { id: request.id, from: request.status, to: 'cancelled', userId, note: 'The person left before this leave.' });
        cancelled += 1;
        if (request.status === 'approved') reversed += await this.reverseTaken(tx, request, userId, 'Left before this leave');
        continue;
      }
      // Approved, and it spans the last day: reverse only the days after it, latest lots first.
      const type = await this.leave.findType(request.leaveTypeId, tx);
      if (!type) continue;
      const after = await this.count(
        employee.id,
        { startsOn: addDays(lastDay, 1), endsOn: request.endsOn, startHalf: 'full', endHalf: request.endHalf },
        type,
        tx,
      );
      const taken = await this.leave.unreversedTaken(request.id, tx);
      const rows = after.byMonth.flatMap((share) => {
        let left = share.days;
        return taken
          .filter((t) => monthOf(t.effectiveOn) === share.period)
          .reverse()
          .flatMap((row) => {
            const back = Math.min(left, -row.days);
            left = tenth(left - back);
            return back > 0
              ? [{
                  orgId: employee.orgId,
                  employeeId: employee.id,
                  leaveTypeId: request.leaveTypeId,
                  kind: 'reversal' as const,
                  days: back,
                  effectiveOn: row.effectiveOn,
                  leaveRequestId: request.id,
                  reversesId: row.id,
                  lotId: row.lotId,
                  reason: 'Left before these days',
                  createdByUserId: userId,
                }]
              : [];
          });
      });
      await this.leave.insertLedger(tx, rows);
      reversed += rows.length;
    }
    return { cancelled, reversed };
  }

  // --- Encashment (AC-LV11; 058-payroll's pay claim calls this) ------------------------------

  /**
   * Turn days into pay: one `encashed` row per lot drawn, from the lots valid
   * today, soonest to expire first. Refused for a type that is not encashable,
   * or a balance short of the days. Runs inside the claim's transaction.
   */
  async encash(tx: Tx, employee: EmployeeRow, type: LeaveTypeRow, days: number, userId: string, reason: string, on: string = kigaliToday()): Promise<void> {
    if (!type.encashable) throw new UnprocessableEntityException(`${type.name} cannot be paid out.`);
    const today = on;
    await this.catchUpAccruals(employee, [type], tx);
    const items = await this.leave.ledgerOf(employee.id, type.id, tx);
    const draws = drawLots(items, type.reset, today, days);
    if (draws.some((d) => d.lotId === null)) {
      throw new ConflictException(`${employee.legalName} has fewer than ${fmt(days)} day${days === 1 ? '' : 's'} of ${type.name.toLowerCase()} to pay out.`);
    }
    await this.leave.insertLedger(
      tx,
      draws.map((d) => ({
        orgId: employee.orgId,
        employeeId: employee.id,
        leaveTypeId: type.id,
        kind: 'encashed' as const,
        days: -d.days,
        effectiveOn: today,
        lotId: d.lotId,
        reason,
        createdByUserId: userId,
      })),
    );
  }

  /**
   * What is left of the lots valid on a date, from the ledger as written: a
   * leaver's unused days on their last day (058-payroll AC-PY13). Unlike
   * `availableOn`, nothing not yet earned is counted.
   */
  async remainingOn(employee: Pick<EmployeeRow, 'id' | 'orgId' | 'hiredOn' | 'status' | 'offboardedOn'>, type: LeaveTypeRow, date: string, tx?: Tx): Promise<number> {
    await this.catchUpAccruals(employee, [type], tx);
    const items = await this.leave.ledgerOf(employee.id, type.id, tx);
    return tenth(
      lotStates(items, type.reset)
        .filter((l) => validOn(l, date))
        .reduce((sum, l) => sum + Math.max(0, l.remaining), 0),
    );
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Days a range takes for this person (AC-L3, 058-time AC-TM12, AC-LV10): their
   * rostered days, else the branch's working days; holidays never count. A type
   * that counts weekly days off or holidays inside its range counts them too, as
   * maternity leave counts calendar days.
   */
  async count(employeeId: string, range: LeaveRange, type: Pick<LeaveTypeRow, 'countsWeeklyOffs' | 'countsHolidays'>, tx?: Tx): Promise<LeaveCount> {
    const holidays = new Set<string>();
    if (!type.countsHolidays) {
      for (const year of yearsTouched(range)) {
        const row = await this.rules.publicHolidays(year, tx);
        if (!row) {
          throw new ConflictException(
            `The public holidays for ${year} are not recorded (${HR_RULE.publicHolidays}), so leave in ${year} cannot be counted yet.`,
          );
        }
        for (const d of row.value.dates) holidays.add(d.date);
      }
    }
    const person = await this.employees.find(employeeId, tx);
    let offs = weeklyOffsFor(null, []);
    if (person) {
      const [orgHolidays, weeklyOffs] = await Promise.all([this.settings.holidays(person.orgId, tx), this.settings.weeklyOffs(person.orgId, tx)]);
      if (!type.countsHolidays) {
        for (const date of eachDate(range.startsOn, range.endsOn)) {
          if (isOrgHoliday(date, person.workPropertyId, orgHolidays)) holidays.add(date);
        }
      }
      offs = weeklyOffsFor(person.workPropertyId, weeklyOffs);
    }
    const rosteredDates = await this.time.rosteredDates(employeeId, range.startsOn, range.endsOn, tx);
    return countLeaveDays(range, {
      rosteredDates,
      holidays,
      isWeeklyOff: type.countsWeeklyOffs ? () => false : (date) => isWeeklyOff(date, offs),
    });
  }

  /** A restricted period this request falls under is a refusal naming it (AC-LV9). */
  private async assertNotRestricted(
    orgId: string,
    employee: EmployeeRow,
    type: LeaveTypeRow,
    range: Pick<LeaveRange, 'startsOn' | 'endsOn'>,
    tx?: Tx,
  ): Promise<void> {
    if (type.statutory) return;
    const periods = await this.extra.periods(orgId, { from: range.startsOn, to: range.endsOn }, tx);
    if (periods.length === 0) return;
    const hit = restrictionFor(periods, {
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      leaveTypeId: type.id,
      statutory: type.statutory,
      departmentIds: await this.extra.departmentsOfPerson(employee.id, tx),
      jobPositionId: employee.jobPositionId,
    });
    if (hit) {
      throw new UnprocessableEntityException(`Leave is restricted during ${hit.title} (${hit.fromDate} to ${hit.toDate}).`);
    }
  }

  /** Is there someone else at the branch who decides leave (AC-LV7)? */
  private async anotherDecider(orgId: string, branchId: string | null, exclude: readonly (string | null)[], tx: Tx): Promise<boolean> {
    const { members, overrides } = await this.extra.members(orgId, tx);
    return members.some(
      (m) =>
        !exclude.includes(m.userId) &&
        effectivePermissionsForRole(m.orgRole, overrides).includes('leave.approve') &&
        (m.branchIds.length === 0 || (branchId !== null && m.branchIds.includes(branchId))),
    );
  }

  /** Write a reversal for each `taken` row of a request not yet reversed, naming the same lot. */
  private async reverseTaken(tx: Tx, request: LeaveRequestRow, userId: string, reason: string): Promise<number> {
    const taken = await this.leave.unreversedTaken(request.id, tx);
    await this.leave.insertLedger(
      tx,
      taken.map((row) => ({
        orgId: request.orgId,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        kind: 'reversal' as const,
        days: -row.days,
        effectiveOn: row.effectiveOn,
        leaveRequestId: request.id,
        reversesId: row.id,
        lotId: row.lotId,
        reason,
        createdByUserId: userId,
      })),
    );
    return taken.length;
  }

  /**
   * The request, proved to be this business's, and the caller allowed to decide
   * it: never their own (403), never outside their branches (403) (AC-L5).
   */
  private async decidable(ws: ScopedWorkspace, userId: string, id: string): Promise<LeaveRequestRow> {
    const orgId = orgOf(ws);
    const request = assertOwnedByOrg(await this.leave.findRequest(id), ws);
    const me = await this.employees.findForUser(orgId, userId);
    if (me !== null && me === request.employeeId) throw new ForbiddenException('Nobody decides their own leave. Someone else must.');
    assertPersonInReach(ws, request.workPropertyId);
    return request;
  }

  async presentById(id: string, orgId: string, userId: string | null, me?: string | null): Promise<LeaveRequest> {
    const row = await this.leave.findRequest(id);
    if (!row) throw new NotFoundException();
    const caller = me !== undefined ? me : userId ? await this.employees.findForUser(orgId, userId) : null;
    return presentRequest(row, caller, await this.leave.approvalsOf([id]));
  }

  /** Requests as a list presents them, approvals fetched once for all. */
  async presentMany(rows: readonly LeaveRequestRow[], me: string | null): Promise<LeaveRequest[]> {
    const approvals = await this.leave.approvalsOf(rows.map((r) => r.id));
    return rows.map((r) => presentRequest(r, me, approvals));
  }
}

function assertRange(range: LeaveRange): void {
  if (!isCalendarDate(range.startsOn) || !isCalendarDate(range.endsOn)) throw new UnprocessableEntityException('Those are not real dates.');
  if (range.endsOn < range.startsOn) throw new UnprocessableEntityException('The leave ends before it starts.');
  if (isContradictoryHalfDay(range)) {
    throw new UnprocessableEntityException('A one day leave cannot start in the afternoon and end at lunch. Choose one half.');
  }
  if (range.endsOn > addDays(range.startsOn, 366)) throw new UnprocessableEntityException('A leave request covers at most a year.');
}

function fmt(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

export function presentType(row: LeaveTypeRow): LeaveType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    payment: row.payment,
    paymentPercent: row.paymentPercent,
    yearlyEntitlementDays: row.yearlyEntitlementDays,
    accrual: row.accrual,
    reset: row.reset,
    carry: row.carry,
    carryMaxDays: row.carryMaxDays,
    carryExpiresMonths: row.carryExpiresMonths,
    approvalSteps: row.approvalSteps,
    needsAttachment: row.needsAttachment,
    countsWeeklyOffs: row.countsWeeklyOffs,
    countsHolidays: row.countsHolidays,
    eligibleSex: row.eligibleSex,
    minServiceMonths: row.minServiceMonths,
    oncePerEmployment: row.oncePerEmployment,
    statutory: row.statutory,
    allowsPastRequests: row.allowsPastRequests,
    encashable: row.encashable,
    compensatory: row.compensatory,
    seniorityEveryYears: row.seniorityEveryYears,
    seniorityExtraDays: row.seniorityExtraDays,
    seniorityCapDays: row.seniorityCapDays,
  };
}

function presentEntry(e: LedgerRow): LeaveBalances['balances'][number]['entries'][number] {
  return {
    id: e.id,
    kind: e.kind,
    days: e.days,
    effectiveOn: e.effectiveOn,
    periodKey: e.periodKey,
    leaveRequestId: e.leaveRequestId,
    reason: e.reason,
    expiresOn: e.expiresOn,
    lotId: e.lotId,
  };
}

/** The lots with days left, soonest to end first: why a person has 4 days, not 6. */
function presentLots(entries: readonly LedgerRow[], type: LeaveTypeRow, today: string): LeaveLot[] {
  return lotStates(entries, type.reset)
    .filter((l) => l.remaining > 0 && (l.usableUntil === null || l.usableUntil >= today))
    .sort((a, b) => (a.usableUntil ?? '9999').localeCompare(b.usableUntil ?? '9999') || a.effectiveOn.localeCompare(b.effectiveOn))
    .map((l) => ({ id: l.id, kind: l.kind, effectiveOn: l.effectiveOn, usableUntil: l.usableUntil, creditDays: l.credit, remainingDays: l.remaining }));
}

export function presentRequest(row: LeaveRequestRow, callerEmployeeId: string | null, approvals: readonly ApprovalRow[]): LeaveRequest {
  return {
    id: row.id,
    employee: rosterCard({ id: row.employeeId, preferredName: row.preferredName, legalName: row.legalName, jobPositionTitle: row.jobPositionTitle }),
    branchId: row.workPropertyId,
    leaveType: { id: row.leaveTypeId, code: row.leaveTypeCode, name: row.leaveTypeName },
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    startHalf: row.startHalf,
    endHalf: row.endHalf,
    days: row.days,
    reason: row.reason,
    status: row.status,
    routedToEmployeeId: row.routedToEmployeeId,
    routedToName: row.routedToName,
    routedToMe: callerEmployeeId !== null && row.routedToEmployeeId === callerEmployeeId,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    payment: row.payment,
    paymentPercent: row.paymentPercent,
    approvalSteps: row.approvalSteps,
    currentStep: row.currentStep,
    approvals: approvals
      .filter((a) => a.requestId === row.id)
      .map((a) => ({ step: a.step, decision: a.decision, decidedByName: a.decidedByName, note: a.note, decidedAt: a.decidedAt.toISOString() })),
    hasAttachment: row.attachmentKey !== null,
  };
}
