import type {
  CreateLeaveRequestRequest,
  LeaveBalances,
  LeaveRequest,
  LeaveBulkRequest,
  LeaveRequestPage,
  ListIds,
  ListQuery,
  BulkResponse,
  LeaveType,
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
import { addDays, eachDate, kigaliToday, monthOf } from '../domain/hr-calendar';
import { HR_RULE, missingRuleMessage } from '../domain/hr-rules';
import { isOrgHoliday, isWeeklyOff, weeklyOffsFor } from '../domain/time-rules';
import { dueAccruals } from '../domain/leave-accrual';
import {
  countLeaveDays,
  isContradictoryHalfDay,
  yearsTouched,
  type LeaveCount,
  type LeaveRange,
} from '../domain/leave-days';
import {
  EmployeesRepository,
  violatedConstraint,
  type EmployeeRow,
  type Tx,
} from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import {
  LeaveRepository,
  type LeaveRequestRow,
  type LeaveTypeRow,
} from '../infrastructure/leave.repository';
import { TimeRepository } from '../infrastructure/time.repository';
import { TimeSettingsRepository } from '../infrastructure/time-settings.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/**
 * Leave (ADR-058, first thread): types, balances, requests and decisions.
 *
 * A balance is only ever the sum of the ledger. Leave writes for one person run
 * under a lock on their file row, so two requests that together overdraw a
 * balance, or two approvals of one request, cannot both pass (AC-L4, AC-L5).
 * Days are estimated at request and counted again at approval, because the
 * roster can move in between.
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly leave: LeaveRepository,
    private readonly time: TimeRepository,
    private readonly rules: HrRulesRepository,
    private readonly settings: TimeSettingsRepository,
  ) {}

  // --- Types and accrual ---------------------------------------------------

  /**
   * The business's leave types, created from the defaults row in force the
   * first time anything asks (AC-L1). A missing row is refused, never guessed.
   */
  async ensureTypes(orgId: string): Promise<LeaveTypeRow[]> {
    const existing = await this.leave.listTypes(orgId);
    if (existing.length > 0) return existing;
    const today = kigaliToday();
    const defaults = await this.rules.leaveDefaults(today);
    if (!defaults) {
      throw new ConflictException(missingRuleMessage(HR_RULE.leaveDefaults, today));
    }
    await this.leave.createTypesFromDefaults(orgId, defaults);
    return this.leave.listTypes(orgId);
  }

  /**
   * Write whatever accruals this person is owed up to today (AC-L2).
   *
   * The daily job is what normally does this. It is also run here, before any
   * balance is read or checked, so a balance never depends on whether the
   * worker ran this morning. The rows are the job's rows (no author) and the
   * ledger's unique period key makes writing them twice impossible.
   */
  async catchUpAccruals(
    employee: Pick<EmployeeRow, 'id' | 'orgId' | 'hiredOn' | 'status' | 'offboardedOn'>,
    types: readonly LeaveTypeRow[],
    tx?: Tx,
  ): Promise<number> {
    const today = kigaliToday();
    const through =
      employee.status === 'offboarded' && employee.offboardedOn && employee.offboardedOn < today
        ? employee.offboardedOn
        : today;
    const rows = types.flatMap((type) =>
      dueAccruals({ type, hiredOn: employee.hiredOn, through }).map((a) => ({
        orgId: employee.orgId,
        employeeId: employee.id,
        leaveTypeId: type.id,
        days: a.days,
        effectiveOn: a.effectiveOn,
        periodKey: a.periodKey,
      })),
    );
    return this.leave.insertAccruals(rows, tx);
  }

  // --- Reads ---------------------------------------------------------------

  /** `GET /ops/employees/:id/leave-balances`. */
  async balances(ws: ScopedWorkspace, employeeId: string): Promise<LeaveBalances> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(employeeId), ws);
    assertInBranchScope(ws, employee.workPropertyId);
    const types = await this.ensureTypes(orgId);
    await this.catchUpAccruals(employee, types);
    const ledger = await this.leave.ledger(employee.id);
    return {
      employeeId: employee.id,
      balances: types.map((type) => {
        const entries = ledger.filter((e) => e.leaveTypeId === type.id);
        const keepsBalance = type.yearlyEntitlementDays !== null;
        return {
          leaveType: presentType(type),
          balanceDays: keepsBalance ? round1(entries.reduce((s, e) => s + e.days, 0)) : null,
          entries: entries.map((e) => ({
            id: e.id,
            kind: e.kind,
            days: e.days,
            effectiveOn: e.effectiveOn,
            periodKey: e.periodKey,
            leaveRequestId: e.leaveRequestId,
            reason: e.reason,
          })),
        };
      }),
    };
  }

  /**
   * `GET /ops/leave/requests`: one page of the queue through the list
   * contract; by default what is routed to the caller comes first.
   */
  async list(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<LeaveRequestPage> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    const page = await this.leave.listRequestsPage({ orgId, scope: ws.branchScope, query, me });
    return pageOf(
      page.rows.map((r) => presentRequest(r, me)),
      page.total,
      query,
      { groups: page.groups, statusCounts: page.statusCounts },
    );
  }

  /** `GET /ops/leave/requests/ids`: select all over the queue, up to the bulk cap (AC-LF15). */
  async ids(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ListIds> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    return this.leave.listRequestIds({ orgId, scope: ws.branchScope, query, me });
  }

  /**
   * `POST /ops/leave/requests/bulk`: approve or refuse several requests. Each
   * goes through the single command, with its own checks, its own lock on the
   * file and its own audit row, so one refusal (a request already decided, a
   * person's own leave) is that row's result and undoes nothing (AC-LF6).
   */
  bulk(ws: ScopedWorkspace, userId: string, body: LeaveBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) =>
      body.action === 'approve' ? this.approve(ws, userId, id, note) : this.reject(ws, userId, id, note),
    );
  }

  // --- Request -------------------------------------------------------------

  /** `POST /ops/leave/requests`: file leave for someone, with estimated days. */
  async request(ws: ScopedWorkspace, userId: string, body: CreateLeaveRequestRequest): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    if (employee.status !== 'active') {
      throw new ConflictException(`${employee.legalName} has left, so no leave can be requested for them.`);
    }
    const types = await this.ensureTypes(orgId);
    const type = types.find((t) => t.id === body.leaveTypeId);
    if (!type) throw new NotFoundException('That leave type is not available here.');

    const range: LeaveRange = {
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      startHalf: body.startHalf ?? 'full',
      endHalf: body.endHalf ?? 'full',
    };
    assertRange(range);
    if (employee.offboardedOn && range.endsOn > employee.offboardedOn) {
      throw new UnprocessableEntityException('That leave runs past their last day.');
    }

    const created = await this.employees.withEmployeeLock(employee.id, async (tx, locked) => {
      await this.catchUpAccruals(locked, types, tx);
      const count = await this.count(locked.id, range, tx);
      if (count.days <= 0) {
        throw new UnprocessableEntityException('Those dates hold no working day, so there is nothing to take.');
      }
      if (type.yearlyEntitlementDays !== null) {
        const balance = await this.leave.balance(locked.id, type.id, tx);
        const pending = await this.leave.pendingDays(locked.id, type.id, null, tx);
        const available = round1(balance - pending);
        if (count.days > available) {
          throw new ConflictException(
            `${locked.legalName} has ${fmt(available)} day${available === 1 ? '' : 's'} of ${type.name.toLowerCase()} left${pending > 0 ? ` after ${fmt(pending)} already requested` : ''}, and this asks for ${fmt(count.days)}.`,
          );
        }
      }
      let id: string;
      try {
        id = await this.leave.insertRequest(tx, {
          orgId,
          employeeId: locked.id,
          leaveTypeId: type.id,
          startsOn: range.startsOn,
          endsOn: range.endsOn,
          startHalf: range.startHalf,
          endHalf: range.endHalf,
          days: count.days,
          reason: body.reason?.trim() || null,
          routedToEmployeeId: locked.reportingManagerId,
          requestedByUserId: userId,
        });
      } catch (error) {
        if (violatedConstraint(error, '23P01') === 'leave_requests_no_overlap') {
          throw new ConflictException('These dates overlap leave this person already has requested or approved.');
        }
        throw error;
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: locked.id,
        eventType: 'hr.leave_requested',
        orgId,
        diff: { leaveRequestId: id, leaveType: type.code, startsOn: range.startsOn, endsOn: range.endsOn, days: count.days },
      });
      return id;
    });
    if (!created) throw new NotFoundException();
    return this.presentById(created, orgId, userId);
  }

  // --- Decisions -----------------------------------------------------------

  /** `POST /ops/leave/requests/:id/approve`. */
  async approve(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const types = await this.ensureTypes(orgId);
    const type = types.find((t) => t.id === request.leaveTypeId);
    if (!type) throw new NotFoundException();

    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const current = await this.leave.findRequest(id, tx);
      if (!current || current.status !== 'requested') {
        throw new ConflictException(`That request is ${current?.status ?? 'gone'} now, so it cannot be approved.`);
      }
      await this.catchUpAccruals(employee, types, tx);
      const count = await this.count(employee.id, current, tx);
      if (count.days <= 0) {
        throw new ConflictException('Those dates hold no working day any more. Reject the request instead.');
      }
      if (type.yearlyEntitlementDays !== null) {
        const balance = round1(await this.leave.balance(employee.id, type.id, tx));
        if (count.days > balance) {
          throw new ConflictException(
            `${employee.legalName} has ${fmt(balance)} day${balance === 1 ? '' : 's'} of ${type.name.toLowerCase()} left, and this takes ${fmt(count.days)}.`,
          );
        }
      }
      const moved = await this.leave.decide(tx, {
        id,
        from: 'requested',
        to: 'approved',
        userId,
        note,
        days: count.days,
      });
      if (!moved) throw new ConflictException('Someone decided that request a moment ago.');
      // One `taken` row per calendar month the leave covers (AC-L4).
      await this.leave.insertLedger(
        tx,
        count.byMonth.map((share) => ({
          orgId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          kind: 'taken' as const,
          days: -share.days,
          effectiveOn: share.effectiveOn,
          leaveRequestId: id,
          reversesId: null,
          reason: null,
          createdByUserId: userId,
        })),
      );
      // Their shifts in the range come off the roster (AC-T3).
      const cancelled = await this.time.cancelScheduledBetween(
        tx,
        employee.id,
        current.startsOn,
        current.endsOn,
        'On approved leave',
      );
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_approved',
        orgId,
        diff: { leaveRequestId: id, days: count.days, shiftsCancelled: cancelled },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, orgId, userId);
  }

  /** `POST /ops/leave/requests/:id/reject`. */
  async reject(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const moved = await this.leave.decide(tx, { id, from: 'requested', to: 'rejected', userId, note });
      if (!moved) throw new ConflictException('That request is no longer waiting for a decision.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_rejected',
        orgId,
        diff: { leaveRequestId: id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, orgId, userId);
  }

  /**
   * `POST /ops/leave/requests/:id/cancel`. A waiting request is simply
   * cancelled; an approved one writes one `reversal` per `taken` row, the same
   * days with the opposite sign and the same date (AC-L5).
   */
  async cancel(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const current = await this.leave.findRequest(id, tx);
      if (!current || (current.status !== 'requested' && current.status !== 'approved')) {
        throw new ConflictException(`That request is ${current?.status ?? 'gone'}, so there is nothing to cancel.`);
      }
      const moved = await this.leave.decide(tx, { id, from: current.status, to: 'cancelled', userId, note });
      if (!moved) throw new ConflictException('Someone decided that request a moment ago.');
      let reversed = 0;
      if (current.status === 'approved') {
        reversed = await this.reverseTaken(tx, current, userId, 'Leave cancelled');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_cancelled',
        orgId,
        diff: { leaveRequestId: id, from: current.status, reversedRows: reversed },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, orgId, userId);
  }

  // --- Offboarding (AC-O1) -------------------------------------------------

  /**
   * Leave after a person's last day, inside the offboarding transaction: a
   * waiting request is cancelled; an approved one starting after the last day is
   * cancelled and reversed; one spanning the last day keeps its days up to it
   * and has the rest reversed. Counted BEFORE their shifts come off the roster,
   * because the count reads the roster.
   */
  async closeAfterLastDay(
    tx: Tx,
    employee: EmployeeRow,
    lastDay: string,
    userId: string,
  ): Promise<{ cancelled: number; reversed: number }> {
    const open = await this.leave.openEndingAfter(employee.id, lastDay, tx);
    let cancelled = 0;
    let reversed = 0;
    for (const request of open) {
      if (request.status === 'requested' || request.startsOn > lastDay) {
        await this.leave.decide(tx, {
          id: request.id,
          from: request.status,
          to: 'cancelled',
          userId,
          note: 'The person left before this leave.',
        });
        cancelled += 1;
        if (request.status === 'approved') {
          reversed += await this.reverseTaken(tx, request, userId, 'Left before this leave');
        }
        continue;
      }
      // Approved, and it spans the last day: reverse only the days after it.
      const after = await this.count(
        employee.id,
        { startsOn: addDays(lastDay, 1), endsOn: request.endsOn, startHalf: 'full', endHalf: request.endHalf },
        tx,
      );
      const taken = await this.leave.unreversedTaken(request.id, tx);
      const rows = after.byMonth.flatMap((share) => {
        const row = taken.find((t) => monthOf(t.effectiveOn) === share.period);
        if (!row) return [];
        return [
          {
            orgId: employee.orgId,
            employeeId: employee.id,
            leaveTypeId: request.leaveTypeId,
            kind: 'reversal' as const,
            days: Math.min(share.days, -row.days),
            effectiveOn: row.effectiveOn,
            leaveRequestId: request.id,
            reversesId: row.id,
            reason: 'Left before these days',
            createdByUserId: userId,
          },
        ];
      });
      await this.leave.insertLedger(tx, rows);
      reversed += rows.length;
    }
    return { cancelled, reversed };
  }

  // --- Helpers -------------------------------------------------------------

  /** Days a range takes for this person, with the holiday rows it needs (AC-L3). */
  private async count(employeeId: string, range: LeaveRange, tx: Tx): Promise<LeaveCount> {
    const holidays = new Set<string>();
    for (const year of yearsTouched(range)) {
      const row = await this.rules.publicHolidays(year, tx);
      if (!row) {
        throw new ConflictException(
          `The public holidays for ${year} are not recorded (${HR_RULE.publicHolidays}), so leave in ${year} cannot be counted yet.`,
        );
      }
      for (const d of row.value.dates) holidays.add(d.date);
    }
    // The business's own holidays and weekly days off for the person's branch (058-time AC-TM12).
    const person = await this.employees.find(employeeId, tx);
    let offs = weeklyOffsFor(null, []);
    if (person) {
      const [orgHolidays, weeklyOffs] = await Promise.all([
        this.settings.holidays(person.orgId, tx),
        this.settings.weeklyOffs(person.orgId, tx),
      ]);
      for (const date of eachDate(range.startsOn, range.endsOn)) {
        if (isOrgHoliday(date, person.workPropertyId, orgHolidays)) holidays.add(date);
      }
      offs = weeklyOffsFor(person.workPropertyId, weeklyOffs);
    }
    const rosteredDates = await this.time.rosteredDates(employeeId, range.startsOn, range.endsOn, tx);
    return countLeaveDays(range, { rosteredDates, holidays, isWeeklyOff: (date) => isWeeklyOff(date, offs) });
  }

  /** Write a reversal for each `taken` row of a request not yet reversed. */
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
    if (me !== null && me === request.employeeId) {
      throw new ForbiddenException('Nobody decides their own leave. Someone else must.');
    }
    assertPersonInReach(ws, request.workPropertyId);
    return request;
  }

  private async presentById(id: string, orgId: string, userId: string): Promise<LeaveRequest> {
    const row = await this.leave.findRequest(id);
    if (!row) throw new NotFoundException();
    return presentRequest(row, await this.employees.findForUser(orgId, userId));
  }
}

function assertRange(range: LeaveRange): void {
  if (!isCalendarDate(range.startsOn) || !isCalendarDate(range.endsOn)) {
    throw new UnprocessableEntityException('Those are not real dates.');
  }
  if (range.endsOn < range.startsOn) {
    throw new UnprocessableEntityException('The leave ends before it starts.');
  }
  if (isContradictoryHalfDay(range)) {
    throw new UnprocessableEntityException(
      'A one day leave cannot start in the afternoon and end at lunch. Choose one half.',
    );
  }
  if (range.endsOn > addDays(range.startsOn, 366)) {
    throw new UnprocessableEntityException('A leave request covers at most a year.');
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function fmt(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

function presentType(row: LeaveTypeRow): LeaveType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    paid: row.paid,
    yearlyEntitlementDays: row.yearlyEntitlementDays,
    accrual: row.accrual,
    needsApproval: row.needsApproval,
  };
}

export function presentRequest(row: LeaveRequestRow, callerEmployeeId: string | null): LeaveRequest {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    branchId: row.workPropertyId,
    leaveType: { id: row.leaveTypeId, code: row.leaveTypeCode, name: row.leaveTypeName, paid: row.leaveTypePaid },
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
  };
}
