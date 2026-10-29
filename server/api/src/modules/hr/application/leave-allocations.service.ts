import type {
  AllocationAsk,
  BulkResponse,
  CreateLeaveAllocationRequest,
  LeaveAllocationBulkRequest,
  LeaveAllocationPage,
  LeaveAllocationRequest,
  ListIds,
  ListQuery,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { runBulk } from '../../../shared/lists/bulk';
import { pageOf } from '../../../shared/lists/list-query';
import { addMonths, compensatoryDays } from '../domain/leave-lots';
import { kigaliToday, monthOf } from '../domain/hr-calendar';
import { EmployeesRepository, violatedConstraint, type EmployeeRow, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { LeaveExtraRepository, type AllocationRow } from '../infrastructure/leave-extra.repository';
import { LeaveRepository, type LeaveTypeRow } from '../infrastructure/leave.repository';
import { TimeRepository, type AttendanceRow } from '../infrastructure/time.repository';
import { AttendanceCloser } from './attendance-closer';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';
import { LeaveService } from './leave.service';

/** Who asks for days: the office on someone's behalf, or the person through self service. */
export interface AllocationActor {
  orgId: string;
  workspaceId: string | null;
  userId: string;
  selfService: boolean;
}

/**
 * Requests for more days (058-leave AC-LV8): extra days on a type, with a
 * reason, or the compensatory days a worked holiday or day off earns.
 *
 * Approval writes one `adjustment` lot, the only way a person's days grow
 * outside accrual and carry. A compensatory lot lands in the one type marked
 * compensatory and lives that type's months. A day compensated by leave is
 * paid once: its approved overtime becomes zero, and a day whose overtime a
 * confirmed pay run already counted is refused rather than paid twice. One
 * request per person and work date, whatever corrections the record later
 * has, held by a partial unique index rather than by the read before it.
 */
@Injectable()
export class LeaveAllocationsService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly leave: LeaveRepository,
    private readonly extra: LeaveExtraRepository,
    private readonly time: TimeRepository,
    private readonly closer: AttendanceCloser,
    private readonly leaveService: LeaveService,
  ) {}

  // --- The queue ---------------------------------------------------------------------

  async list(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<LeaveAllocationPage> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    const page = await this.extra.allocationPage({ orgId, scope: ws.branchScope, query, me });
    return pageOf(page.rows.map((r) => presentAllocation(r, me)), page.total, query, {
      groups: page.groups,
      statusCounts: page.statusCounts,
    });
  }

  async ids(ws: ScopedWorkspace, userId: string, query: ListQuery): Promise<ListIds> {
    const orgId = orgOf(ws);
    const me = await this.employees.findForUser(orgId, userId);
    return this.extra.allocationIds({ orgId, scope: ws.branchScope, query, me });
  }

  bulk(ws: ScopedWorkspace, userId: string, body: LeaveAllocationBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) => (body.action === 'approve' ? this.approve(ws, userId, id, note) : this.reject(ws, userId, id, note)));
  }

  // --- Asking ------------------------------------------------------------------------

  /** `POST /ops/leave/allocation-requests`: ask on someone's behalf. */
  async create(ws: ScopedWorkspace, userId: string, body: CreateLeaveAllocationRequest): Promise<LeaveAllocationRequest> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const id = await this.createFor({ orgId, workspaceId: ws.workspaceId, userId, selfService: false }, employee, askOf(body));
    const me = await this.employees.findForUser(orgId, userId);
    return this.presentById(id, me);
  }

  /** Ask for days for a person, from the office or from self service; answers the request's id. */
  async createFor(actor: AllocationActor, employee: EmployeeRow, ask: AllocationAsk): Promise<string> {
    if (employee.status !== 'active') {
      throw new ConflictException(`${employee.legalName} has left, so no days can be asked for them.`);
    }
    const types = await this.leaveService.ensureTypes(actor.orgId);
    let type: LeaveTypeRow;
    let days: number;
    let record: AttendanceRow | null = null;
    if (ask.kind === 'extra') {
      const found = types.find((t) => t.id === ask.leaveTypeId);
      if (!found) throw new NotFoundException('That leave type is not available here.');
      if (found.yearlyEntitlementDays === null) {
        throw new UnprocessableEntityException(`${found.name} keeps no balance, so there is nothing to add days to.`);
      }
      type = found;
      days = ask.days;
    } else {
      type = this.compensatoryType(types);
      record = await this.compensableRecord(employee, ask.attendanceRecordId);
      days = await this.daysEarned(employee, record);
      await this.assertOvertimeUnpaid(actor.orgId, record);
    }
    const created = await this.employees.withEmployeeLock(employee.id, async (tx, locked) => {
      let id: string;
      try {
        id = await this.extra.insertAllocation(tx, {
          orgId: actor.orgId,
          employeeId: locked.id,
          leaveTypeId: type.id,
          kind: ask.kind,
          days,
          attendanceRecordId: record?.id ?? null,
          workDate: record?.workDate ?? null,
          reason: ask.reason.trim(),
          routedToEmployeeId: locked.reportingManagerId,
          requestedByUserId: actor.userId,
        });
      } catch (error) {
        if (violatedConstraint(error) === 'leave_allocation_requests_compensated_uk') {
          throw new ConflictException(`${record?.workDate ?? 'That day'} is already compensated, or waiting to be.`);
        }
        throw error;
      }
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: locked.id,
        eventType: 'hr.leave_allocation_requested',
        orgId: actor.orgId,
        diff: { allocationRequestId: id, kind: ask.kind, leaveType: type.code, days, workDate: record?.workDate ?? null, selfService: actor.selfService },
      });
      return id;
    });
    if (!created) throw new NotFoundException();
    return created;
  }

  // --- Deciding ----------------------------------------------------------------------

  /**
   * `POST /ops/leave/allocation-requests/:id/approve`: one `adjustment` lot. For
   * compensatory days, the record is read again under the lock: a correction
   * since the request may have changed the minutes, and the days are counted
   * from what the record says now.
   */
  async approve(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveAllocationRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      const current = await this.extra.findAllocation(id, tx);
      if (!current || current.status !== 'requested') {
        throw new ConflictException(`That request is ${current?.status ?? 'gone'} now, so it cannot be approved.`);
      }
      const type = await this.leave.findType(current.leaveTypeId, tx);
      if (!type) throw new NotFoundException();
      let days = current.days;
      let expiresOn: string | null = null;
      const today = kigaliToday();
      if (current.kind === 'compensatory') {
        const record = await this.latestRecordFor(employee, current, tx);
        days = await this.daysEarned(employee, record, tx);
        await this.assertOvertimeUnpaid(orgId, record, tx);
        expiresOn = type.carryExpiresMonths ? addMonths(today, type.carryExpiresMonths) : null;
        // Paid once, as time off: the day's holiday overtime no longer counts.
        await this.time.decideOvertime(tx, record.id, 0);
      }
      if (!(await this.extra.moveAllocation(tx, id, 'approved', { decidedByUserId: userId, decisionNote: note }))) {
        throw new ConflictException('Someone decided that request a moment ago.');
      }
      await this.leave.insertLedger(tx, [
        {
          orgId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          kind: 'adjustment',
          days,
          effectiveOn: today,
          expiresOn,
          allocationRequestId: id,
          reason: current.kind === 'compensatory' ? `Worked ${current.workDate}` : current.reason,
          createdByUserId: userId,
        },
      ]);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_allocation_approved',
        orgId,
        diff: { allocationRequestId: id, kind: current.kind, days, expiresOn },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'allocation.decided',
        aggregateType: 'leave_allocation_request',
        aggregateId: id,
        change: 'approved',
        workspaceId: ws.workspaceId,
        payload: { allocationRequestId: id, employeeId: employee.id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, await this.employees.findForUser(orgId, userId));
  }

  async reject(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<LeaveAllocationRequest> {
    const orgId = orgOf(ws);
    const request = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(request.employeeId, async (tx, employee) => {
      if (!(await this.extra.moveAllocation(tx, id, 'rejected', { decidedByUserId: userId, decisionNote: note }))) {
        throw new ConflictException('That request is no longer waiting for a decision.');
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.leave_allocation_rejected',
        orgId,
        diff: { allocationRequestId: id },
        reason: note,
      });
      await writeHrEvent(tx, {
        trigger: 'allocation.decided',
        aggregateType: 'leave_allocation_request',
        aggregateId: id,
        change: 'rejected',
        workspaceId: ws.workspaceId,
        payload: { allocationRequestId: id, employeeId: employee.id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id, await this.employees.findForUser(orgId, userId));
  }

  /** A person withdraws their own request while it still waits (AC-SS6). */
  async cancelOwn(actor: { orgId: string; userId: string }, employeeId: string, id: string): Promise<void> {
    const done = await this.employees.withEmployeeLock(employeeId, async (tx) => {
      const current = await this.extra.findAllocation(id, tx);
      if (!current || current.employeeId !== employeeId) throw new NotFoundException();
      if (!(await this.extra.moveAllocation(tx, id, 'cancelled'))) {
        throw new ConflictException(`That request is ${current.status}, so there is nothing to withdraw.`);
      }
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employeeId,
        eventType: 'hr.leave_allocation_cancelled',
        orgId: actor.orgId,
        diff: { allocationRequestId: id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
  }

  // --- Reads for self service --------------------------------------------------------

  async presentById(id: string, me: string | null): Promise<LeaveAllocationRequest> {
    const row = await this.extra.findAllocation(id);
    if (!row) throw new NotFoundException();
    return presentAllocation(row, me);
  }

  async mine(employeeId: string): Promise<LeaveAllocationRequest[]> {
    return (await this.extra.allocationsOf(employeeId)).map((r) => presentAllocation(r, employeeId));
  }

  async routedTo(employeeId: string): Promise<LeaveAllocationRequest[]> {
    return (await this.extra.allocationsRoutedTo(employeeId)).map((r) => presentAllocation(r, employeeId));
  }

  // --- Helpers -----------------------------------------------------------------------

  private compensatoryType(types: readonly LeaveTypeRow[]): LeaveTypeRow {
    const type = types.find((t) => t.compensatory);
    if (!type) {
      throw new ConflictException('No leave type here takes compensatory days. Mark one as compensatory in Leave types first.');
    }
    return type;
  }

  /** One of the person's records, validated, closed and current, on a holiday or a day off (AC-LV8). */
  private async compensableRecord(employee: EmployeeRow, recordId: string, tx?: Tx): Promise<AttendanceRow> {
    const record = await this.time.findRecord(recordId, tx);
    if (!record || record.employeeId !== employee.id) throw new NotFoundException('That attendance record is not this person’s.');
    if (record.status !== 'closed' || !record.clockOutAt) {
      throw new UnprocessableEntityException('That record is still open or was corrected. Ask for the record that stands.');
    }
    if (!record.validated) throw new UnprocessableEntityException('That record is not validated yet, so it earns nothing so far.');
    if (record.dayKind !== 'public_holiday' && record.dayKind !== 'weekly_off') {
      throw new UnprocessableEntityException(`${record.workDate} was a working day, so working it earns no compensatory day.`);
    }
    return record;
  }

  /**
   * The record that stands for the request's work date now: the one asked for,
   * or what superseded it since. Corrections never earn a second request, but
   * the days are counted from the current minutes.
   */
  private async latestRecordFor(employee: EmployeeRow, request: AllocationRow, tx: Tx): Promise<AttendanceRow> {
    if (!request.attendanceRecordId) throw new UnprocessableEntityException('That request names no record.');
    const records = await this.time.personRecords({ employeeIds: [employee.id], from: request.workDate ?? '', to: request.workDate ?? '' }, tx);
    const standing = records.find((r) => r.status === 'closed' && r.validated && (r.dayKind === 'public_holiday' || r.dayKind === 'weekly_off'));
    if (!standing) {
      throw new ConflictException(`No validated record stands for ${request.workDate} now, so there is nothing to compensate. Refuse the request.`);
    }
    return standing;
  }

  /** 1 day from the branch policy's threshold, half at half of it (AC-LV8); none below is a refusal. */
  private async daysEarned(employee: EmployeeRow, record: AttendanceRow, tx?: Tx): Promise<number> {
    const rules = await this.closer.rulesFor(employee.orgId, record.workPropertyId ?? employee.workPropertyId, tx);
    const days = compensatoryDays(record.workedMinutes ?? 0, rules.compensationThresholdMinutes);
    if (days === 0) {
      throw new UnprocessableEntityException(
        `${record.workDate} counts ${record.workedMinutes ?? 0} minutes worked, and half a day needs ${Math.ceil(rules.compensationThresholdMinutes / 2)}.`,
      );
    }
    return days;
  }

  /** A day whose overtime a confirmed pay run already counted is paid; compensating it too would pay it twice. */
  private async assertOvertimeUnpaid(orgId: string, record: AttendanceRow, tx?: Tx): Promise<void> {
    if (!record.approvedOvertimeMinutes) return;
    const frozen = await this.employees.latestConfirmedPeriod(orgId, tx);
    if (frozen && monthOf(record.workDate) <= monthOf(frozen)) {
      throw new ConflictException(`The overtime of ${record.workDate} is in a confirmed pay run, so the day is paid already.`);
    }
  }

  private async decidable(ws: ScopedWorkspace, userId: string, id: string): Promise<AllocationRow> {
    const orgId = orgOf(ws);
    const request = assertOwnedByOrg(await this.extra.findAllocation(id), ws);
    const me = await this.employees.findForUser(orgId, userId);
    if (me !== null && me === request.employeeId) throw new ForbiddenException('Nobody decides their own days. Someone else must.');
    assertPersonInReach(ws, request.workPropertyId);
    return request;
  }
}

function askOf(body: CreateLeaveAllocationRequest): AllocationAsk {
  return body.kind === 'extra'
    ? { kind: 'extra', leaveTypeId: body.leaveTypeId, days: body.days, reason: body.reason }
    : { kind: 'compensatory', attendanceRecordId: body.attendanceRecordId, reason: body.reason };
}

export function presentAllocation(r: AllocationRow, me: string | null): LeaveAllocationRequest {
  return {
    id: r.id,
    employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
    branchId: r.workPropertyId,
    leaveType: { id: r.leaveTypeId, name: r.leaveTypeName },
    kind: r.kind,
    days: r.days,
    attendanceRecordId: r.attendanceRecordId,
    workDate: r.workDate,
    reason: r.reason,
    status: r.status,
    routedTo: r.routedToEmployeeId
      ? rosterCard({ id: r.routedToEmployeeId, preferredName: r.routedPreferredName, legalName: r.routedLegalName ?? '', jobPositionTitle: r.routedPositionTitle })
      : null,
    routedToMe: me !== null && r.routedToEmployeeId === me,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decidedByName: r.decidedByName,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
  };
}
