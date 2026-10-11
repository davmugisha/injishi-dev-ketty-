import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { MyHrRepository } from '../infrastructure/my-hr.repository';
import { payslipFilename, toPayslipPage } from '../../payroll/domain/payslip-page';
import { PayslipPdfRenderer } from '../../payroll/infrastructure/payslip-pdf.renderer';
import { AttendanceService, type EntryDto, type MyTime } from './attendance.service';
import { LeaveService } from './leave.service';

type LeaveType = 'annual' | 'sick' | 'unpaid' | 'other';

const LEAVE_TYPES: readonly LeaveType[] = ['annual', 'sick', 'unpaid', 'other'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What an employee does for THEMSELVES (HR module, self-service — first pass,
 * no ADR yet): ask for leave, mark their own tasks done, and read their own
 * payslips.
 *
 * HR keeps the other half. A request made here lands on the Leave tab as
 * `pending` and is decided there, behind `employee.manage`. A task can be
 * ticked from either side — the employee confirms their own work is done, and
 * HR can still tick or untick it. Nothing in this service approves a request,
 * or edits or reads anybody else's record, and none of it takes a member id from the caller — who "I" am is the
 * session's user, looked up in `MyHrRepository.employments`.
 */
@Injectable()
export class MyHrService {
  constructor(
    private readonly mine: MyHrRepository,
    private readonly leave: LeaveService,
    private readonly attendance: AttendanceService,
    private readonly pdf: PayslipPdfRenderer,
  ) {}

  /** Whether this user is an employee here at all, and in which departments. */
  async overview(ws: WorkspaceAccess, userId: string) {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return { employments };
  }

  async myLeave(ws: WorkspaceAccess, userId: string) {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    const requests = await this.mine.leaveRequests(employments.map((e) => e.departmentMemberId));

    // Balances are kept per department record, and a request is filed under
    // one of them. Somebody in two departments is still one person taking
    // leave, so their allowance and days used are added across their records —
    // reading only one showed "0 days used" beside a fortnight of approved leave.
    // The allowance is the one HR sees: worked out from the type's rule and
    // the day they started, unless HR set it by hand. `basis` says how.
    const year = new Date().getFullYear();
    const everyone = await this.leave.balances(ws, year);
    const mine = employments.map((e) => e.departmentMemberId);
    const balances = (['annual', 'sick'] as const).map((leaveType) => ({
      leaveType,
      ...this.leave.summarise(everyone.balances, mine, leaveType),
    }));

    // The rules HR set per leave type, so the form can state them before
    // somebody fills it in rather than only refusing afterwards.
    const rules = (await this.leave.listTypeSettings(ws)).map((s) => ({
      leaveType: s.leaveType,
      applicableAfterDays: s.applicableAfterDays,
      maxConsecutiveDays: s.maxConsecutiveDays,
    }));

    return { year, requests, balances, rules };
  }

  async requestLeave(
    ws: WorkspaceAccess,
    userId: string,
    body: { leaveType: LeaveType; startDate: string; endDate: string; reason?: string },
  ) {
    if (!LEAVE_TYPES.includes(body.leaveType)) {
      throw new BadRequestException('Choose a leave type.');
    }
    if (!ISO_DATE.test(body.startDate ?? '') || !ISO_DATE.test(body.endDate ?? '')) {
      throw new BadRequestException('Choose the first and last day of the leave.');
    }
    if (body.endDate < body.startDate) {
      throw new BadRequestException('The last day cannot be before the first day.');
    }

    const [primary] = await this.mine.employments(ws.workspaceId, userId);
    if (!primary) {
      throw new BadRequestException(
        'You have no employee record here yet. Ask HR to add you as an employee first.',
      );
    }

    return this.leave.createRequest(
      ws,
      primary.departmentMemberId,
      body.leaveType,
      body.startDate,
      body.endDate,
      body.reason?.trim() || undefined,
    );
  }

  /** Take back a request that HR has not answered yet. */
  async withdrawLeave(ws: WorkspaceAccess, userId: string, requestId: string) {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    const withdrawn = await this.mine.withdrawLeave(
      employments.map((e) => e.departmentMemberId),
      requestId,
    );
    // Somebody else's request, one already answered and one that does not
    // exist all answer the same.
    if (!withdrawn) {
      throw new NotFoundException('That request can no longer be withdrawn.');
    }
  }

  async myTasks(ws: WorkspaceAccess, userId: string) {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return this.mine.tasks(employments.map((e) => e.departmentMemberId));
  }

  /** The employee confirms one of their own tasks is done, or takes that back. */
  async setMyTaskDone(ws: WorkspaceAccess, userId: string, itemId: string, done: boolean) {
    if (typeof done !== 'boolean') {
      throw new BadRequestException('Say whether the task is done.');
    }
    const employments = await this.mine.employments(ws.workspaceId, userId);
    const changed = await this.mine.setTaskDone(
      employments.map((e) => e.departmentMemberId),
      itemId,
      done,
      userId,
    );
    // Somebody else's task and a task that does not exist answer the same.
    if (!changed) throw new NotFoundException('That task is not on your checklist.');
  }

  async myPayslips(ws: WorkspaceAccess, userId: string) {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return this.mine.payslips(employments.map((e) => e.departmentMemberId));
  }

  /**
   * One of the caller's own payslips as a PDF. The id is matched against the
   * caller's own records first, so somebody else's payslip, a draft, and one
   * that does not exist all answer the same.
   */
  async myPayslipPdf(
    ws: WorkspaceAccess,
    userId: string,
    payslipId: string,
  ): Promise<{ filename: string; body: Buffer }> {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    const record = await this.mine.findOwnPayslip(
      employments.map((e) => e.departmentMemberId),
      payslipId,
    );
    if (!record) throw new NotFoundException('That payslip is not one of yours.');
    return { filename: payslipFilename(record), body: await this.pdf.render([toPayslipPage(record)]) };
  }

  /** The caller's own clock, shifts and recent days. */
  async myTime(ws: WorkspaceAccess, userId: string): Promise<MyTime> {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return this.attendance.mine(ws, employments.map((e) => e.departmentMemberId));
  }

  /**
   * Clock the caller in or out. Whose record it is comes from the session, as
   * everywhere here: the primary employment first, so somebody rostered in
   * neither department still clocks against their home one.
   */
  async clockIn(ws: WorkspaceAccess, userId: string): Promise<EntryDto> {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return this.attendance.clockIn(ws, userId, employments.map((e) => e.departmentMemberId));
  }

  async clockOut(ws: WorkspaceAccess, userId: string): Promise<EntryDto> {
    const employments = await this.mine.employments(ws.workspaceId, userId);
    return this.attendance.clockOut(ws, employments.map((e) => e.departmentMemberId));
  }
}
