import type {
  CreateMyLeaveAllocationRequest,
  CreateMyLeaveRequestRequest,
  LeaveAllocationRequest,
  LeaveRequest,
  MyLeaveAllocationList,
  MyLeaveBalances,
  MyLeaveRequestList,
  MyLeaveTypeList,
  MyUpload,
} from '@injishi/contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { kigaliToday } from '../domain/hr-calendar';
import { eligibilityRefusal } from '../domain/leave-lots';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { HR_FILE_LINK_SECONDS, HrFilesService } from './hr-files.service';
import { LeaveAllocationsService } from './leave-allocations.service';
import { LeaveService, presentType } from './leave.service';

/**
 * Self service for leave (058-self-service AC-SS6, the routes marked 5):
 * the types a person may ask for, their balances with the lots behind them,
 * their requests and their asks for more days.
 *
 * Ownership is the guard, as everywhere under `me/work` (index contract 10):
 * a file that is not the caller's answers 404 before anything is read, and a
 * file the person has left is read only. Nothing here decides anything, and a
 * person withdraws their own request only while it still waits.
 */
@Injectable()
export class MyLeaveService {
  constructor(
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly leave: LeaveRepository,
    private readonly leaveService: LeaveService,
    private readonly allocations: LeaveAllocationsService,
    private readonly files: HrFilesService,
  ) {}

  /** The active types this person may ask for today: eligibility already applied (AC-LV6). */
  async types(userId: string, employeeId: string): Promise<MyLeaveTypeList> {
    const employee = await this.mine(userId, employeeId);
    const types = await this.leaveService.ensureTypes(employee.orgId);
    const today = kigaliToday();
    const open: typeof types = [];
    for (const type of types) {
      const taken = type.oncePerEmployment ? await this.leave.takenBefore(employee.id, type.id) : false;
      if (eligibilityRefusal(type, { sex: employee.sex, serviceFrom: employee.serviceFrom }, today, taken) === null) open.push(type);
    }
    return { types: open.map(presentType) };
  }

  async balances(userId: string, employeeId: string): Promise<MyLeaveBalances> {
    return this.leaveService.balancesOf(await this.mine(userId, employeeId));
  }

  async requests(userId: string, employeeId: string): Promise<MyLeaveRequestList> {
    const employee = await this.mine(userId, employeeId);
    return { requests: await this.leaveService.presentMany(await this.leave.requestsOf(employee.id), employee.id) };
  }

  async createRequest(userId: string, employeeId: string, body: CreateMyLeaveRequestRequest): Promise<LeaveRequest> {
    const employee = await this.mineActive(userId, employeeId);
    const id = await this.leaveService.requestFor(
      { orgId: employee.orgId, workspaceId: await this.work.workspaceOf(employee.orgId), userId, selfService: true, mayDecide: false },
      employee,
      body,
    );
    return this.leaveService.presentById(id, employee.orgId, null, employee.id);
  }

  /** Withdraw a request still waiting (AC-SS6). Approved leave is cancelled by the office. */
  async cancelRequest(userId: string, employeeId: string, id: string): Promise<LeaveRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.leaveService.cancelFor({ orgId: employee.orgId, userId }, employee.id, id, null, true);
    return this.leaveService.presentById(id, employee.orgId, null, employee.id);
  }

  /** The person's own attachment, as a five minute link. */
  async attachment(userId: string, employeeId: string, id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const employee = await this.mine(userId, employeeId);
    const request = await this.leave.findRequest(id);
    if (!request || request.employeeId !== employee.id || !request.attachmentKey) throw new NotFoundException();
    return { url: await this.files.link(request.attachmentKey), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  async allocationRequests(userId: string, employeeId: string): Promise<MyLeaveAllocationList> {
    const employee = await this.mine(userId, employeeId);
    return { requests: await this.allocations.mine(employee.id) };
  }

  async createAllocation(userId: string, employeeId: string, body: CreateMyLeaveAllocationRequest): Promise<LeaveAllocationRequest> {
    const employee = await this.mineActive(userId, employeeId);
    const id = await this.allocations.createFor(
      { orgId: employee.orgId, workspaceId: await this.work.workspaceOf(employee.orgId), userId, selfService: true },
      employee,
      body,
    );
    return this.allocations.presentById(id, employee.id);
  }

  async cancelAllocation(userId: string, employeeId: string, id: string): Promise<LeaveAllocationRequest> {
    const employee = await this.mineActive(userId, employeeId);
    await this.allocations.cancelOwn({ orgId: employee.orgId, userId }, employee.id, id);
    return this.allocations.presentById(id, employee.id);
  }

  /**
   * `POST /me/work/:employeeId/files`: a sick note or the like, stored against
   * the employer's workspace and answered with its key, which a leave request
   * then names. The person may upload an attachment and nothing else.
   */
  async upload(userId: string, employeeId: string, input: { body: Buffer; filename: string }): Promise<MyUpload> {
    const employee = await this.mineActive(userId, employeeId);
    const workspaceId = await this.work.workspaceOf(employee.orgId);
    if (!workspaceId) throw new ConflictException('This business has no workspace to keep the file in.');
    const stored = await this.files.upload({ workspaceId }, userId, { ...input, purpose: 'attachment' });
    return { key: stored.objectKey, contentType: stored.mime, sizeBytes: stored.sizeBytes };
  }

  // --- A reporting manager's team (AC-SS15): rows routed to them, read only ---------------

  async teamLeave(userId: string, employeeId: string, id: string): Promise<LeaveRequest> {
    const manager = await this.mine(userId, employeeId);
    const row = await this.leave.findRequest(id);
    if (!row || row.routedToEmployeeId !== manager.id) throw new NotFoundException();
    return this.leaveService.presentById(id, manager.orgId, null, manager.id);
  }

  async teamAllocation(userId: string, employeeId: string, id: string): Promise<LeaveAllocationRequest> {
    const manager = await this.mine(userId, employeeId);
    const row = await this.allocations.presentById(id, manager.id).catch(() => null);
    if (!row || !row.routedToMe) throw new NotFoundException();
    return row;
  }

  async teamLeaveRows(managerId: string): Promise<LeaveRequest[]> {
    return this.leaveService.presentMany(await this.leave.requestsRoutedTo(managerId), managerId);
  }

  async teamAllocationRows(managerId: string): Promise<LeaveAllocationRequest[]> {
    return this.allocations.routedTo(managerId);
  }

  // --- Ownership -----------------------------------------------------------------------

  /** The caller's file, or 404: a probe for any other id learns nothing (index contract 10). */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  /** A write needs the file active (AC-S1). */
  private async mineActive(userId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.mine(userId, employeeId);
    if (employee.status !== 'active') throw new ConflictException('You no longer work here, so this file is read only.');
    return employee;
  }
}
