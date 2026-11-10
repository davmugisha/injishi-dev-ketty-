import type {
  AttendanceRequest,
  AttendanceRequestPage,
  BulkResponse,
  CreateAttendanceRequestRequest,
  CreateMyAttendanceRequestRequest,
  CreateMyShiftRequestRequest,
  CreateShiftRequestRequest,
  ListIds,
  ListQuery,
  ShiftRequest,
  ShiftRequestPage,
  TimeRequestBulkRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { runBulk } from '../../../shared/lists/bulk';
import { pageOf } from '../../../shared/lists/list-query';
import { isCalendarDate } from '../../pms/domain/pricing';
import { addDays, eachDate, kigaliDateOf, kigaliToday, lastOfMonth, monthOf, shiftInstants } from '../domain/hr-calendar';
import { EmployeesRepository, violatedConstraint, type EmployeeRow, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { RotationRepository } from '../infrastructure/rotation.repository';
import {
  TimeRequestsRepository,
  type AttendanceRequestRow,
  type ShiftRequestRow,
} from '../infrastructure/time-requests.repository';
import { TimeRepository } from '../infrastructure/time.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';
import { RotationService } from './rotation.service';
import { TimeService } from './time.service';

const AHEAD_MS = 5 * 60_000;

/** Who acts on a request, and where the events it raises are filed. */
export interface RequestActor {
  orgId: string;
  workspaceId: string | null;
  userId: string;
}

/**
 * Shift and swap requests, and attendance requests (ADR-058, 058-time AC-TM5,
 * AC-TM6; index contracts 6 and 12).
 *
 * A request is routed to the person's reporting manager as it is asked, so a
 * later change of manager does not move it; it is decided by a holder of the
 * module's permission for the person's branch, never by somebody it is about,
 * and only while it is open, so of two racing decisions one wins. Self service
 * raises the same requests through the same methods (`createShift`,
 * `createAttendance`), with the person's own file as the path.
 */
@Injectable()
export class TimeRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly requests: TimeRequestsRepository,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly leave: LeaveRepository,
    private readonly timeService: TimeService,
    private readonly rotationPatterns: RotationRepository,
    private readonly rotationService: RotationService,
  ) {}

  // --- Shift requests (AC-TM5) ----------------------------------------------------------

  async shiftPage(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ShiftRequestPage> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    const page = await this.requests.shiftPage({ orgId, scope: ws.branchScope, query, me });
    return pageOf(page.rows.map((r) => presentShift(r, me)), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  async shiftIds(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ListIds> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    return this.requests.shiftIds({ orgId, scope: ws.branchScope, query, me });
  }

  /** `POST /ops/shift-requests`: on someone's behalf (`roster.manage`). */
  async createShiftFor(ws: ScopedWorkspace, userId: string, body: CreateShiftRequestRequest): Promise<ShiftRequest> {
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const { employeeId: _ignored, ...rest } = body;
    void _ignored;
    const id = await this.createShift({ orgId: orgOf(ws), workspaceId: ws.workspaceId, userId }, employee, rest);
    return this.shiftById(id, await this.employees.findForUser(orgOf(ws), userId));
  }

  /**
   * Raise a shift, swap or rotation request for a person. A swap names a colleague
   * at the same branch and waits for them to accept (or, when they have no account,
   * for someone who manages the roster to accept for them). A day that has passed,
   * or a swap with no shift to move, is refused here rather than at the decision.
   */
  async createShift(actor: RequestActor, employee: EmployeeRow, body: CreateMyShiftRequestRequest): Promise<string> {
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left.`);
    if (!isCalendarDate(body.from) || !isCalendarDate(body.to)) throw new UnprocessableEntityException('That is not a real date.');
    if (body.from < kigaliToday()) throw new UnprocessableEntityException('That day has passed.');
    let templateId: string | null = null;
    let colleague: EmployeeRow | null = null;
    let rotationPatternId: string | null = null;
    if (body.kind === 'rotation') {
      const pattern = await this.rotationPatterns.findPattern(body.rotationPatternId);
      if (!pattern || pattern.orgId !== actor.orgId || pattern.status !== 'active' || pattern.propertyId !== employee.workPropertyId) {
        throw new UnprocessableEntityException('Ask for an active rotation of the branch the person works at.');
      }
      const running = await this.rotationPatterns.runningFor(employee.id);
      if (running?.patternId === pattern.id) throw new ConflictException('You are already on this rotation.');
      rotationPatternId = pattern.id;
    } else if (body.kind === 'change') {
      const template = await this.time.findTemplate(body.shiftTemplateId);
      if (!template || template.orgId !== actor.orgId || template.status !== 'active' || template.propertyId !== employee.workPropertyId) {
        throw new UnprocessableEntityException('Ask for an active shift of the branch the person works at.');
      }
      templateId = template.id;
    } else {
      colleague = await this.employees.find(body.swapEmployeeId);
      if (!colleague || colleague.orgId !== actor.orgId || colleague.status !== 'active') {
        throw new UnprocessableEntityException('Name a colleague who works here.');
      }
      if (colleague.id === employee.id) throw new UnprocessableEntityException('A swap is with someone else.');
      if (colleague.workPropertyId !== employee.workPropertyId) {
        throw new UnprocessableEntityException('A swap is with a colleague at the same branch.');
      }
      const people = [employee.id, colleague.id];
      const [existing, leaveA, leaveB] = await Promise.all([
        this.time.scheduledOn(people, body.from, body.to),
        this.leave.approvedBetween(employee.id, body.from, body.to),
        this.leave.approvedBetween(colleague.id, body.from, body.to),
      ]);
      const away = [...leaveA, ...leaveB];
      let movable = false;
      for (const date of eachDate(body.from, body.to)) {
        if (away.some((l) => l.startsOn <= date && l.endsOn >= date)) continue;
        if (existing.some((e) => e.workDate === date)) movable = true;
      }
      if (!movable) throw new UnprocessableEntityException('Neither of you has a shift to swap that day.');
    }
    return this.db.transaction(async (tx) => {
      const id = await this.requests.insertShift(tx, {
        orgId: actor.orgId,
        employeeId: employee.id,
        kind: body.kind,
        shiftTemplateId: templateId,
        swapEmployeeId: colleague?.id ?? null,
        rotationPatternId,
        fromDate: body.from,
        toDate: body.to,
        reason: body.reason.trim(),
        status: body.kind === 'swap' ? 'awaiting_colleague' : 'requested',
        routedToEmployeeId: employee.reportingManagerId,
        requestedByUserId: actor.userId,
      });
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.shift_requested',
        orgId: actor.orgId,
        diff: { shiftRequestId: id, kind: body.kind, from: body.from, to: body.to },
      });
      if (colleague) {
        await writeHrEvent(tx, {
          trigger: 'swap.requested',
          aggregateType: 'shift_request',
          aggregateId: id,
          change: 'requested',
          workspaceId: actor.workspaceId,
          payload: { shiftRequestId: id, employeeId: colleague.id },
        });
      }
      return id;
    });
  }

  /**
   * The colleague says yes (self service), or somebody who manages the roster
   * says it for a colleague with no account. Only then can it be decided.
   */
  async acceptSwap(actor: RequestActor, id: string, by: { colleagueId: string } | { forColleagueWithoutAccount: true }): Promise<void> {
    const row = await this.requests.findShift(id);
    if (!row || row.orgId !== actor.orgId || row.kind !== 'swap') throw new NotFoundException();
    if ('colleagueId' in by && row.swapEmployeeId !== by.colleagueId) throw new NotFoundException();
    if ('forColleagueWithoutAccount' in by) {
      const colleague = row.swapEmployeeId ? await this.employees.find(row.swapEmployeeId) : null;
      if (colleague?.orgMembershipId && colleague.membershipStatus === 'active') {
        throw new ConflictException('This colleague has an account, so they accept it themselves.');
      }
    }
    await this.db.transaction(async (tx) => {
      const moved = await this.requests.moveShift(tx, row.id, ['awaiting_colleague'], 'requested', {
        colleagueAcceptedAt: new Date(),
        colleagueAcceptedByUserId: 'forColleagueWithoutAccount' in by ? actor.userId : null,
      });
      if (!moved) throw new ConflictException('This swap is not waiting for the colleague any more.');
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: row.swapEmployeeId ?? row.employeeId,
        eventType: 'hr.swap_accepted',
        orgId: actor.orgId,
        diff: { shiftRequestId: row.id, forColleague: 'forColleagueWithoutAccount' in by },
      });
    });
  }

  /** The colleague says no: the swap is refused, and the person who asked reads why. */
  async declineSwap(actor: RequestActor, id: string, colleagueId: string): Promise<void> {
    const row = await this.requests.findShift(id);
    if (!row || row.orgId !== actor.orgId || row.swapEmployeeId !== colleagueId) throw new NotFoundException();
    await this.db.transaction(async (tx) => {
      const name = row.swapPreferredName?.trim() || row.swapLegalName || 'Your colleague';
      const moved = await this.requests.moveShift(tx, row.id, ['awaiting_colleague'], 'rejected', {
        decidedByUserId: actor.userId,
        decisionNote: `${name} said no.`,
      });
      if (!moved) throw new ConflictException('This swap is not waiting for you any more.');
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: colleagueId,
        eventType: 'hr.swap_declined',
        orgId: actor.orgId,
        diff: { shiftRequestId: row.id },
      });
      await writeHrEvent(tx, {
        trigger: 'shift_request.decided',
        aggregateType: 'shift_request',
        aggregateId: row.id,
        change: 'declined',
        workspaceId: actor.workspaceId,
        payload: { shiftRequestId: row.id, employeeId: row.employeeId },
      });
    });
  }

  /** Withdraw an open request: the person through self service, or the roster on their behalf. */
  async cancelShift(actor: RequestActor, id: string, onlyOf?: string): Promise<void> {
    const row = await this.requests.findShift(id);
    if (!row || row.orgId !== actor.orgId || (onlyOf && row.employeeId !== onlyOf)) throw new NotFoundException();
    await this.db.transaction(async (tx) => {
      if (!(await this.requests.moveShift(tx, row.id, ['requested', 'awaiting_colleague'], 'cancelled'))) {
        throw new ConflictException('This request is no longer open.');
      }
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: row.employeeId,
        eventType: 'hr.shift_request_cancelled',
        orgId: actor.orgId,
        diff: { shiftRequestId: row.id },
      });
    });
  }

  async cancelShiftOps(ws: ScopedWorkspace, userId: string, id: string): Promise<ShiftRequest> {
    const row = assertOwnedByOrg(await this.requests.findShift(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    await this.cancelShift({ orgId: orgOf(ws), workspaceId: ws.workspaceId, userId }, row.id);
    return this.shiftById(row.id, await this.employees.findForUser(orgOf(ws), userId));
  }

  async acceptSwapForColleague(ws: ScopedWorkspace, userId: string, id: string): Promise<ShiftRequest> {
    const row = assertOwnedByOrg(await this.requests.findShift(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    await this.acceptSwap({ orgId: orgOf(ws), workspaceId: ws.workspaceId, userId }, row.id, { forColleagueWithoutAccount: true });
    return this.shiftById(row.id, await this.employees.findForUser(orgOf(ws), userId));
  }

  /**
   * Approve (AC-TM5): in one transaction locking both people's files in id
   * order, the person's scheduled shifts on each date of the range are replaced
   * by the asked one (a change), or the two people's shifts are exchanged (a
   * swap; a date where only one has a shift moves it to the other). The new
   * shifts name the request, and are published where the old ones were or the
   * range is. A day of approved leave is left alone.
   */
  async approveShift(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<ShiftRequest> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.requests.findShift(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    const me = await this.employees.findForUser(orgId, userId);
    if (me && (me === row.employeeId || me === row.swapEmployeeId)) {
      throw new ForbiddenException('Nobody decides a request they are part of. Someone else must.');
    }
    if (row.status === 'awaiting_colleague') throw new ConflictException('The colleague has not accepted this swap yet.');
    if (row.status !== 'requested') throw new ConflictException('This request is no longer open.');
    if (row.kind === 'rotation') return this.approveRotation(ws, userId, row, me, note);
    const people = [row.employeeId, ...(row.swapEmployeeId ? [row.swapEmployeeId] : [])];
    try {
      await this.db.transaction(async (tx) => {
        await this.employees.lockTx(tx, people);
        if (!(await this.requests.moveShift(tx, row.id, ['requested'], 'approved', { decidedByUserId: userId, decisionNote: note }))) {
          throw new ConflictException('This request was decided a moment ago.');
        }
        const existing = await this.time.scheduledOn(people, row.fromDate, row.toDate, tx);
        const leaveDays = new Map<string, { startsOn: string; endsOn: string }[]>();
        for (const p of people) leaveDays.set(p, await this.leave.approvedBetween(p, row.fromDate, row.toDate, tx));
        const onLeave = (p: string, d: string): boolean => (leaveDays.get(p) ?? []).some((l) => l.startsOn <= d && l.endsOn >= d);
        const template = row.shiftTemplateId ? await this.time.findTemplate(row.shiftTemplateId, tx) : null;
        if (row.kind === 'change' && (!template || template.status !== 'active')) {
          throw new ConflictException('The shift asked for has been retired since.');
        }
        const now = new Date();
        let moved = 0;
        for (const date of eachDate(row.fromDate, row.toDate)) {
          if (row.kind === 'change' && template) {
            if (onLeave(row.employeeId, date)) continue;
            const mine = existing.filter((e) => e.employeeId === row.employeeId && e.workDate === date);
            for (const e of mine) await this.time.cancelEntry(tx, e.id, 'Replaced by an approved shift request.');
            const instants = shiftInstants(date, template.startsAt, template.endsAt);
            const published =
              mine.some((e) => e.publishedAt !== null) ||
              (await this.time.isPublishedDate({ orgId, propertyId: template.propertyId, departmentId: template.departmentId, date }, tx));
            await this.time.insertEntry(tx, {
              orgId,
              employeeId: row.employeeId,
              shiftTemplateId: template.id,
              propertyId: template.propertyId,
              departmentId: template.departmentId,
              workDate: date,
              startsAt: instants.startsAt,
              endsAt: instants.endsAt,
              createdByUserId: userId,
              publishedAt: published ? now : null,
              shiftRequestId: row.id,
            });
            moved++;
          } else if (row.swapEmployeeId) {
            if (onLeave(row.employeeId, date) || onLeave(row.swapEmployeeId, date)) continue;
            const a = existing.filter((e) => e.employeeId === row.employeeId && e.workDate === date);
            const b = existing.filter((e) => e.employeeId === row.swapEmployeeId && e.workDate === date);
            for (const e of [...a, ...b]) await this.time.cancelEntry(tx, e.id, 'Exchanged by an approved swap.');
            const moves = [
              ...a.map((e) => ({ e, to: row.swapEmployeeId as string })),
              ...b.map((e) => ({ e, to: row.employeeId })),
            ];
            for (const { e, to } of moves) {
              await this.time.insertEntry(tx, {
                orgId,
                employeeId: to,
                shiftTemplateId: e.shiftTemplateId,
                propertyId: e.propertyId,
                departmentId: e.departmentId,
                workDate: e.workDate,
                startsAt: e.startsAt,
                endsAt: e.endsAt,
                createdByUserId: userId,
                publishedAt: e.publishedAt ? now : null,
                shiftRequestId: row.id,
              });
              moved++;
            }
          }
        }
        // Leave taken or a shift moved since the ask can leave nothing to do: say so, and change nothing.
        if (moved === 0) throw new ConflictException('Nothing would change: there is no shift to move on those days. Decline it instead.');
        for (const p of people) {
          await writeHrAudit(tx, {
            actorUserId: userId,
            subjectType: 'employee',
            subjectId: p,
            eventType: 'hr.shift_request_approved',
            orgId,
            diff: { shiftRequestId: row.id, kind: row.kind },
            reason: note,
          });
          await writeHrEvent(tx, {
            trigger: 'shift_request.decided',
            aggregateType: 'shift_request',
            aggregateId: row.id,
            change: `approved:${p}`,
            workspaceId: ws.workspaceId,
            payload: { shiftRequestId: row.id, employeeId: p },
          });
        }
      });
    } catch (error) {
      if (violatedConstraint(error, '23P01') === 'roster_entries_no_overlap') {
        throw new ConflictException('That would give someone two shifts at once. Move the clashing shift first.');
      }
      throw error;
    }
    return this.shiftById(row.id, me);
  }

  /**
   * Approve asking to join a rotation: the person comes off any rotation they are on the day before,
   * and joins this one from the day asked (today, if that has passed). Its drafts are written at once.
   */
  private async approveRotation(
    ws: ScopedWorkspace,
    userId: string,
    row: ShiftRequestRow,
    me: string | null,
    note: string | null,
  ): Promise<ShiftRequest> {
    const orgId = orgOf(ws);
    if (!row.rotationPatternId) throw new ConflictException('This request names no rotation.');
    const today = kigaliToday();
    const startsOn = row.fromDate > today ? row.fromDate : today;
    const running = await this.rotationService.runningFor(row.employeeId);
    if (running?.patternId === row.rotationPatternId) throw new ConflictException('They are already on this rotation.');
    if (running) {
      const dayBefore = addDays(startsOn, -1);
      await this.rotationService.end(ws, userId, running.id, { endsOn: dayBefore > running.startsOn ? dayBefore : running.startsOn });
    }
    await this.rotationService.assign(ws, userId, { employeeId: row.employeeId, patternId: row.rotationPatternId, startsOn, startStep: 0 });
    await this.db.transaction(async (tx) => {
      if (!(await this.requests.moveShift(tx, row.id, ['requested'], 'approved', { decidedByUserId: userId, decisionNote: note }))) {
        throw new ConflictException('This request was decided a moment ago.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: row.employeeId,
        eventType: 'hr.shift_request_approved',
        orgId,
        diff: { shiftRequestId: row.id, kind: row.kind, startsOn },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'shift_request.decided',
        aggregateType: 'shift_request',
        aggregateId: row.id,
        change: `approved:${row.employeeId}`,
        workspaceId: ws.workspaceId,
        payload: { shiftRequestId: row.id, employeeId: row.employeeId },
      });
    });
    return this.shiftById(row.id, me);
  }

  async rejectShift(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<ShiftRequest> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.requests.findShift(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    const me = await this.employees.findForUser(orgId, userId);
    if (me && (me === row.employeeId || me === row.swapEmployeeId)) {
      throw new ForbiddenException('Nobody decides a request they are part of. Someone else must.');
    }
    await this.db.transaction(async (tx) => {
      if (!(await this.requests.moveShift(tx, row.id, ['requested', 'awaiting_colleague'], 'rejected', { decidedByUserId: userId, decisionNote: note }))) {
        throw new ConflictException('This request is no longer open.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: row.employeeId,
        eventType: 'hr.shift_request_rejected',
        orgId,
        diff: { shiftRequestId: row.id },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'shift_request.decided',
        aggregateType: 'shift_request',
        aggregateId: row.id,
        change: `rejected:${row.employeeId}`,
        workspaceId: ws.workspaceId,
        payload: { shiftRequestId: row.id, employeeId: row.employeeId },
      });
    });
    return this.shiftById(row.id, me);
  }

  shiftBulk(ws: ScopedWorkspace, userId: string, body: TimeRequestBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) =>
      body.action === 'approve' ? this.approveShift(ws, userId, id, note) : this.rejectShift(ws, userId, id, note),
    );
  }

  async shiftById(id: string, me: string | null): Promise<ShiftRequest> {
    const row = await this.requests.findShift(id);
    if (!row) throw new NotFoundException();
    return presentShift(row, me);
  }

  // --- Attendance requests (AC-TM6) ---------------------------------------------------------

  async attendancePage(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<AttendanceRequestPage> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    const page = await this.requests.attendancePage({ orgId, scope: ws.branchScope, query, me });
    return pageOf(page.rows.map((r) => presentAttendance(r, me)), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  async attendanceIds(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ListIds> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    return this.requests.attendanceIds({ orgId, scope: ws.branchScope, query, me });
  }

  /** `POST /ops/attendance-requests`: on someone's behalf (`attendance.record`). */
  async createAttendanceFor(ws: ScopedWorkspace, userId: string, body: CreateAttendanceRequestRequest): Promise<AttendanceRequest> {
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const id = await this.createAttendance({ orgId: orgOf(ws), workspaceId: ws.workspaceId, userId }, employee, body);
    return this.attendanceById(id, await this.employees.findForUser(orgOf(ws), userId));
  }

  /**
   * Ask for a missing or wrong record of a past day. A day in a month whose pay
   * is confirmed is refused: that is a pay adjustment now (index contract 17).
   */
  async createAttendance(actor: RequestActor, employee: EmployeeRow, body: CreateMyAttendanceRequestRequest): Promise<string> {
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left.`);
    if (!isCalendarDate(body.workDate)) throw new UnprocessableEntityException('That is not a real date.');
    const clockInAt = new Date(body.clockInAt);
    const clockOutAt = new Date(body.clockOutAt);
    if (clockOutAt.getTime() > Date.now() + AHEAD_MS) throw new UnprocessableEntityException('A request is for times that have passed.');
    if (kigaliDateOf(clockInAt) !== body.workDate) {
      throw new UnprocessableEntityException('The clock in must fall on the day asked about.');
    }
    if (body.recordId) {
      const record = await this.time.findRecord(body.recordId);
      if (!record || record.employeeId !== employee.id) throw new UnprocessableEntityException('That record is not this person\'s.');
      if (record.status === 'superseded') throw new ConflictException('That record was corrected already. Ask about the newer one.');
    }
    const frozen = await this.employees.latestConfirmedPeriod(actor.orgId);
    if (frozen && body.workDate <= lastOfMonth(monthOf(frozen))) {
      throw new ConflictException(
        `Pay for ${monthOf(frozen)} is confirmed, so its attendance cannot change. Ask for a pay adjustment instead.`,
      );
    }
    return this.db.transaction(async (tx) => {
      const id = await this.requests.insertAttendance(tx, {
        orgId: actor.orgId,
        employeeId: employee.id,
        workDate: body.workDate,
        clockInAt,
        clockOutAt,
        recordId: body.recordId ?? null,
        reason: body.reason.trim(),
        routedToEmployeeId: employee.reportingManagerId,
        requestedByUserId: actor.userId,
      });
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.attendance_requested',
        orgId: actor.orgId,
        diff: { attendanceRequestId: id, workDate: body.workDate, recordId: body.recordId ?? null },
      });
      return id;
    });
  }

  /**
   * Approve: the record is corrected (a new one supersedes it) or, for a missed
   * day, written whole; validated, figured, and the request names it. One
   * transaction, so a request is never approved without its record.
   */
  async approveAttendance(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<AttendanceRequest> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.requests.findAttendance(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    const me = await this.employees.findForUser(orgId, userId);
    if (me === row.employeeId) throw new ForbiddenException('Nobody decides their own request. Someone else must.');
    if (row.status !== 'requested') throw new ConflictException('This request is no longer open.');
    const within = async (tx: Tx, recordId: string): Promise<void> => {
      if (!(await this.requests.moveAttendance(tx, row.id, 'approved', { decidedByUserId: userId, decisionNote: note, resultRecordId: recordId }))) {
        throw new ConflictException('This request was decided a moment ago.');
      }
      await writeHrEvent(tx, {
        trigger: 'attendance_request.decided',
        aggregateType: 'attendance_request',
        aggregateId: row.id,
        change: 'approved',
        workspaceId: ws.workspaceId,
        payload: { attendanceRequestId: row.id, employeeId: row.employeeId },
      });
    };
    const reasonNote = `Attendance request: ${row.reason}`.slice(0, 300);
    if (row.recordId) {
      const original = await this.time.findRecord(row.recordId);
      if (!original) throw new NotFoundException();
      if (original.status === 'superseded') {
        throw new ConflictException('That record has been corrected since, so this request is out of date. Refuse it.');
      }
      await this.timeService.writeCorrected({
        orgId,
        original,
        clockInAt: row.clockInAt,
        clockOutAt: row.clockOutAt,
        note: reasonNote,
        userId,
        eventType: 'hr.attendance_request_approved',
        reason: note ?? undefined,
        within,
      });
    } else {
      const employee = await this.employees.find(row.employeeId);
      if (!employee) throw new NotFoundException();
      await this.timeService.writeMissing({
        employee,
        clockInAt: row.clockInAt,
        clockOutAt: row.clockOutAt,
        userId,
        note: reasonNote,
        eventType: 'hr.attendance_request_approved',
        within,
      });
    }
    return this.attendanceById(row.id, me);
  }

  async rejectAttendance(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<AttendanceRequest> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.requests.findAttendance(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    const me = await this.employees.findForUser(orgId, userId);
    if (me === row.employeeId) throw new ForbiddenException('Nobody decides their own request. Someone else must.');
    await this.db.transaction(async (tx) => {
      if (!(await this.requests.moveAttendance(tx, row.id, 'rejected', { decidedByUserId: userId, decisionNote: note }))) {
        throw new ConflictException('This request is no longer open.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: row.employeeId,
        eventType: 'hr.attendance_request_rejected',
        orgId,
        diff: { attendanceRequestId: row.id },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'attendance_request.decided',
        aggregateType: 'attendance_request',
        aggregateId: row.id,
        change: 'rejected',
        workspaceId: ws.workspaceId,
        payload: { attendanceRequestId: row.id, employeeId: row.employeeId },
      });
    });
    return this.attendanceById(row.id, me);
  }

  /** The person withdraws their own open request (self service). */
  async cancelAttendance(actor: RequestActor, id: string, employeeId: string): Promise<void> {
    const row = await this.requests.findAttendance(id);
    if (!row || row.orgId !== actor.orgId || row.employeeId !== employeeId) throw new NotFoundException();
    await this.db.transaction(async (tx) => {
      if (!(await this.requests.moveAttendance(tx, row.id, 'cancelled'))) throw new ConflictException('This request is no longer open.');
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employeeId,
        eventType: 'hr.attendance_request_cancelled',
        orgId: actor.orgId,
        diff: { attendanceRequestId: row.id },
      });
    });
  }

  attendanceBulk(ws: ScopedWorkspace, userId: string, body: TimeRequestBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) =>
      body.action === 'approve' ? this.approveAttendance(ws, userId, id, note) : this.rejectAttendance(ws, userId, id, note),
    );
  }

  async attendanceById(id: string, me: string | null): Promise<AttendanceRequest> {
    const row = await this.requests.findAttendance(id);
    if (!row) throw new NotFoundException();
    return presentAttendance(row, me);
  }
}

function card(id: string | null, preferredName: string | null, legalName: string | null, jobPositionTitle: string | null): ShiftRequest['routedTo'] {
  if (!id || !legalName) return null;
  return rosterCard({ id, preferredName, legalName, jobPositionTitle });
}

export function presentShift(row: ShiftRequestRow, me: string | null): ShiftRequest {
  return {
    id: row.id,
    employee: rosterCard({ id: row.employeeId, preferredName: row.preferredName, legalName: row.legalName, jobPositionTitle: row.jobPositionTitle }),
    branchId: row.workPropertyId,
    kind: row.kind,
    shiftTemplate: row.shiftTemplateId && row.shiftTemplateName ? { id: row.shiftTemplateId, name: row.shiftTemplateName } : null,
    swapWith: card(row.swapEmployeeId, row.swapPreferredName, row.swapLegalName, row.swapPositionTitle),
    rotation: row.rotationPatternId && row.rotationName ? { id: row.rotationPatternId, name: row.rotationName } : null,
    fromDate: row.fromDate,
    toDate: row.toDate,
    reason: row.reason,
    status: row.status,
    colleagueAcceptedAt: row.colleagueAcceptedAt ? row.colleagueAcceptedAt.toISOString() : null,
    routedTo: card(row.routedToEmployeeId, row.routedPreferredName, row.routedLegalName, row.routedPositionTitle),
    routedToMe: me !== null && row.routedToEmployeeId === me,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decidedByName: row.decidedByName,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
  };
}

export function presentAttendance(row: AttendanceRequestRow, me: string | null): AttendanceRequest {
  return {
    id: row.id,
    employee: rosterCard({ id: row.employeeId, preferredName: row.preferredName, legalName: row.legalName, jobPositionTitle: row.jobPositionTitle }),
    branchId: row.workPropertyId,
    workDate: row.workDate,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt.toISOString(),
    recordId: row.recordId,
    reason: row.reason,
    status: row.status,
    routedTo: card(row.routedToEmployeeId, row.routedPreferredName, row.routedLegalName, row.routedPositionTitle),
    routedToMe: me !== null && row.routedToEmployeeId === me,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decidedByName: row.decidedByName,
    decisionNote: row.decisionNote,
    resultRecordId: row.resultRecordId,
    createdAt: row.createdAt.toISOString(),
    evidence: row.evidence ?? null,
    managerConfirmedByName: row.managerConfirmedAt ? (row.managerConfirmedByName ?? null) : null,
    managerConfirmedAt: row.managerConfirmedAt ? row.managerConfirmedAt.toISOString() : null,
    recordClockInAt: instantOrNull(row.recordClockInAt),
    recordClockOutAt: instantOrNull(row.recordClockOutAt),
  };
}

/** A timestamp a raw subquery read: the driver hands back a Date, or text when it cannot tell. */
function instantOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
