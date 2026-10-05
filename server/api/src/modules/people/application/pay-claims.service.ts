import type {
  BulkResponse,
  CreateMyPayClaimRequest,
  CreatePayClaimRequest,
  ListIds,
  ListQuery,
  PayClaim,
  PayClaimBulkRequest,
  PayClaimPage,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { runBulk } from '../../../shared/lists/bulk';
import { pageOf } from '../../../shared/lists/list-query';
import { kigaliToday, monthOf } from '../domain/hr-calendar';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { PayItemsRepository, type ClaimRow } from '../infrastructure/pay-items.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { rosterCard } from './employee-presenter';
import { HR_FILE_LINK_SECONDS, HrFilesService } from './hr-files.service';
import { assertPersonInReach, orgOf } from './hr-access';
import { LeaveService } from './leave.service';

export interface ClaimActor {
  orgId: string;
  workspaceId: string | null;
  userId: string;
  selfService: boolean;
}

/**
 * Claims (058-payroll AC-PY9): a reimbursement, paid with the net as money
 * that is not income, or leave paid out, taxed as pay at the day rate. A person
 * raises one through self service, or a `payroll.run` holder raises one for
 * them, once per `Idempotency-Key`. An approved claim is paid on the person's
 * next unconfirmed month; an encashment writes its `encashed` ledger rows as it
 * is approved, so the days cannot be taken as leave as well.
 */
@Injectable()
export class PayClaimsService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly items: PayItemsRepository,
    private readonly records: PayRecordsRepository,
    private readonly leaveRows: LeaveRepository,
    private readonly leave: LeaveService,
    private readonly files: HrFilesService,
  ) {}

  async list(ws: ScopedWorkspace, query: ListQuery): Promise<PayClaimPage> {
    const page = await this.items.claimPage({ orgId: orgOf(ws), scope: ws.branchScope, query });
    return pageOf(page.rows.map(presentClaim), page.total, query, { groups: page.groups, statusCounts: page.statusCounts });
  }

  ids(ws: ScopedWorkspace, query: ListQuery): Promise<ListIds> {
    return this.items.claimIds({ orgId: orgOf(ws), scope: ws.branchScope, query });
  }

  bulk(ws: ScopedWorkspace, userId: string, body: PayClaimBulkRequest): Promise<BulkResponse> {
    const note = body.params?.note?.trim() || null;
    return runBulk(body.ids, (id) => (body.action === 'approve' ? this.approve(ws, userId, id, note) : this.reject(ws, userId, id, note)));
  }

  async create(ws: ScopedWorkspace, userId: string, key: string, body: CreatePayClaimRequest): Promise<PayClaim> {
    const orgId = orgOf(ws);
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    const { employeeId: _ignored, ...ask } = body;
    void _ignored;
    const id = await this.createFor({ orgId, workspaceId: ws.workspaceId, userId, selfService: false }, employee, ask, key);
    return this.presentById(id);
  }

  /** Raise a claim for a person; a second call with the same key answers the first claim. */
  async createFor(actor: ClaimActor, employee: EmployeeRow, ask: CreateMyPayClaimRequest, key: string): Promise<string> {
    const existing = await this.items.claimByKey(actor.orgId, key);
    if (existing) return existing;
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left, so a claim goes through their final settlement.`);
    let receiptKey: string | null = null;
    if (ask.kind === 'reimbursement') {
      receiptKey = ask.receiptKey?.trim() || null;
      if (receiptKey) {
        if (!actor.workspaceId) throw new UnprocessableEntityException('A receipt is not one uploaded here.');
        await this.files.assertOwn({ workspaceId: actor.workspaceId }, 'attachment', [receiptKey]);
      }
    } else {
      const type = await this.leaveRows.findType(ask.leaveTypeId);
      if (!type || type.orgId !== actor.orgId) throw new NotFoundException('That leave type is not this business\'s.');
      if (!type.encashable) throw new UnprocessableEntityException(`${type.name} cannot be paid out.`);
      const available = await this.leave.availableOn(employee, type, kigaliToday());
      if (ask.days > available) {
        throw new ConflictException(`${employee.legalName} has ${available} day${available === 1 ? '' : 's'} of ${type.name.toLowerCase()} to pay out, and this asks for ${ask.days}.`);
      }
    }
    const period = await this.records.nextOpenPeriod(actor.orgId, monthOf(kigaliToday()));
    const id = await this.employees.withEmployeeLock(employee.id, async (tx) => {
      const created = await this.items.insertClaim(tx, {
        orgId: actor.orgId,
        employeeId: employee.id,
        kind: ask.kind,
        amountRwf: ask.kind === 'reimbursement' ? ask.amountRwf : null,
        leaveTypeId: ask.kind === 'leave_encashment' ? ask.leaveTypeId : null,
        days: ask.kind === 'leave_encashment' ? ask.days : null,
        period,
        receiptKey,
        reason: ask.reason.trim(),
        requestedByUserId: actor.userId,
        idempotencyKey: key,
      });
      if (!created) return (await this.items.claimByKey(actor.orgId, key, tx)) as string;
      await writeHrAudit(tx, {
        actorUserId: actor.userId,
        subjectType: 'employee',
        subjectId: employee.id,
        eventType: 'hr.claim_raised',
        orgId: actor.orgId,
        diff: { claimId: created, kind: ask.kind, period, selfService: actor.selfService },
      });
      return created;
    });
    if (!id) throw new NotFoundException();
    return id;
  }

  /**
   * `POST /ops/pay-claims/:id/approve`. Paid on the next unconfirmed month: its
   * own while that run is open, the next once it is confirmed (AC-PY9). An
   * encashment's ledger rows are written in the same transaction.
   */
  async approve(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<PayClaim> {
    const orgId = orgOf(ws);
    const claim = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(claim.employeeId, async (tx, employee) => {
      const current = await this.items.findClaim(id, tx);
      if (!current || current.status !== 'requested') throw new ConflictException(`That claim is ${current?.status ?? 'gone'} now.`);
      const period = await this.records.nextOpenPeriod(orgId, current.period, tx);
      // The month it lands in is locked for share, so a confirm cannot slip between.
      if ((await this.records.fenceMonth(tx, orgId, period)) === 'confirmed') {
        throw new ConflictException('That month was confirmed a moment ago. Try again.');
      }
      if (current.kind === 'leave_encashment' && current.leaveTypeId && current.days) {
        const type = await this.leaveRows.findType(current.leaveTypeId, tx);
        if (!type) throw new NotFoundException();
        await this.leave.encash(tx, employee, type, current.days, userId, `Paid out on claim ${id.slice(0, 8)}`);
      }
      if (!(await this.items.moveClaim(tx, id, 'approved', { userId, note, period }))) {
        throw new ConflictException('Someone decided that claim a moment ago.');
      }
      await writeHrAudit(tx, { actorUserId: userId, subjectType: 'employee', subjectId: employee.id, eventType: 'hr.claim_approved', orgId, diff: { claimId: id, period }, reason: note });
      await writeHrEvent(tx, {
        trigger: 'claim.decided',
        aggregateType: 'pay_claim',
        aggregateId: id,
        change: 'approved',
        workspaceId: ws.workspaceId,
        payload: { claimId: id, employeeId: employee.id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id);
  }

  async reject(ws: ScopedWorkspace, userId: string, id: string, note: string | null): Promise<PayClaim> {
    const orgId = orgOf(ws);
    const claim = await this.decidable(ws, userId, id);
    const done = await this.employees.withEmployeeLock(claim.employeeId, async (tx, employee) => {
      if (!(await this.items.moveClaim(tx, id, 'rejected', { userId, note }))) throw new ConflictException('That claim is no longer waiting.');
      await writeHrAudit(tx, { actorUserId: userId, subjectType: 'employee', subjectId: employee.id, eventType: 'hr.claim_rejected', orgId, diff: { claimId: id }, reason: note });
      await writeHrEvent(tx, {
        trigger: 'claim.decided',
        aggregateType: 'pay_claim',
        aggregateId: id,
        change: 'rejected',
        workspaceId: ws.workspaceId,
        payload: { claimId: id, employeeId: employee.id },
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id);
  }

  /** A person withdraws their own claim while it waits. */
  async cancelOwn(actor: { orgId: string; userId: string }, employeeId: string, id: string): Promise<PayClaim> {
    const done = await this.employees.withEmployeeLock(employeeId, async (tx) => {
      const current = await this.items.findClaim(id, tx);
      if (!current || current.employeeId !== employeeId) throw new NotFoundException();
      if (!(await this.items.moveClaim(tx, id, 'cancelled'))) throw new ConflictException(`That claim is ${current.status}, so there is nothing to withdraw.`);
      await writeHrAudit(tx, { actorUserId: actor.userId, subjectType: 'employee', subjectId: employeeId, eventType: 'hr.claim_cancelled', orgId: actor.orgId, diff: { claimId: id } });
      return true;
    });
    if (!done) throw new NotFoundException();
    return this.presentById(id);
  }

  async receiptLink(ws: ScopedWorkspace, id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const claim = assertOwnedByOrg(await this.items.findClaim(id), ws);
    assertInBranchScope(ws, claim.workPropertyId);
    if (!claim.receiptKey) throw new NotFoundException('That claim has no receipt.');
    return { url: await this.files.link(claim.receiptKey), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  async mine(employeeId: string): Promise<PayClaim[]> {
    return (await this.items.claimsOf(employeeId)).map(presentClaim);
  }

  async presentById(id: string): Promise<PayClaim> {
    const row = await this.items.findClaim(id);
    if (!row) throw new NotFoundException();
    return presentClaim(row);
  }

  /** Nobody decides their own claim. */
  private async decidable(ws: ScopedWorkspace, userId: string, id: string): Promise<ClaimRow> {
    const orgId = orgOf(ws);
    const claim = assertOwnedByOrg(await this.items.findClaim(id), ws);
    const me = await this.employees.findForUser(orgId, userId);
    if (me !== null && me === claim.employeeId) throw new ForbiddenException('Nobody decides their own claim. Someone else must.');
    assertPersonInReach(ws, claim.workPropertyId);
    return claim;
  }
}

export function presentClaim(r: ClaimRow): PayClaim {
  return {
    id: r.id,
    employee: rosterCard({ id: r.employeeId, preferredName: r.preferredName, legalName: r.legalName, jobPositionTitle: r.jobPositionTitle }),
    branchId: r.workPropertyId,
    kind: r.kind,
    amountRwf: r.amountRwf,
    leaveType: r.leaveTypeId ? { id: r.leaveTypeId, name: r.leaveTypeName ?? '' } : null,
    days: r.days,
    period: r.period,
    hasReceipt: r.receiptKey !== null,
    reason: r.reason,
    status: r.status,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decidedByName: r.decidedByName,
    decisionNote: r.decisionNote,
    paid: r.payslipId !== null,
    createdAt: r.createdAt.toISOString(),
  };
}
