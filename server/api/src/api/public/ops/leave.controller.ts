import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { LeaveService } from '../../../modules/hr/application/leave.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';

/**
 * Leave requests, balances, and per-type settings (HR module, Phase 4).
 * Gated on employee.manage.
 *
 * Every route hands the service the workspace: a request id or a member id in
 * a URL or a body could name another business's, and the service looks each
 * one up inside the workspace the guard proved.
 */
@Controller({ path: 'ops/leave', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('requests')
  @RequirePermission('employee.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): ReturnType<LeaveService['list']> {
    return this.leave.list(workspace);
  }

  @Post('requests')
  @RequirePermission('employee.manage')
  createRequest(
    @Body()
    body: {
      departmentMemberId: string;
      leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
      startDate: string;
      endDate: string;
      reason?: string;
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<LeaveService['createRequest']> {
    return this.leave.createRequest(
      workspace,
      body.departmentMemberId,
      body.leaveType,
      body.startDate,
      body.endDate,
      body.reason,
    );
  }

  @Post('requests/:id/decision')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'approved' | 'rejected' },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.leave.decide(workspace, id, body.status, user.id);
  }

  @Post('balances')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async setBalance(
    @Body()
    body: {
      departmentMemberId: string;
      leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
      year: number;
      allocatedDays: number;
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.leave.setBalance(workspace, body.departmentMemberId, body.leaveType, body.year, body.allocatedDays);
  }

  /**
   * Every employee record's allowance and days used for a year. An allowance
   * is worked out from the type's rule unless HR set it by hand; each row says
   * which, and how a worked-out one was reached.
   */
  @Get('balances')
  @RequirePermission('employee.manage')
  balances(
    @Query('year') year: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<LeaveService['balances']> {
    return this.leave.balances(workspace, Number(year) || new Date().getFullYear());
  }

  /** Give every employee the same allowance for a year, by hand. */
  @Post('balances/everyone')
  @RequirePermission('employee.manage')
  setBalanceForEveryone(
    @Body()
    body: { leaveType: 'annual' | 'sick' | 'unpaid' | 'other'; year: number; allocatedDays: number },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<LeaveService['setBalanceForEveryone']> {
    return this.leave.setBalanceForEveryone(workspace, body.leaveType, body.year, body.allocatedDays);
  }

  /**
   * Hand allowances back to the rule: forget the figures set by hand for a
   * year. For the records named, or everybody when none are; for one leave
   * type, or all when none is.
   */
  @Post('balances/reset')
  @RequirePermission('employee.manage')
  resetBalances(
    @Body()
    body: { year: number; leaveType?: 'annual' | 'sick' | 'unpaid' | 'other'; departmentMemberIds?: string[] },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<LeaveService['resetBalances']> {
    return this.leave.resetBalances(workspace, body);
  }

  @Get('balances/:departmentMemberId')
  @RequirePermission('employee.manage')
  getBalance(
    @Param('departmentMemberId', ParseUUIDPipe) departmentMemberId: string,
    @Query('leaveType') leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    @Query('year') year: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<LeaveService['summaryFor']> {
    return this.leave.summaryFor(workspace, [departmentMemberId], leaveType, Number(year) || new Date().getFullYear());
  }

  @Get('type-settings')
  @RequirePermission('employee.manage')
  listTypeSettings(@CurrentWorkspace() workspace: ScopedWorkspace): ReturnType<LeaveService['listTypeSettings']> {
    return this.leave.listTypeSettings(workspace);
  }

  @Post('type-settings')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async setTypeSettings(
    @Body()
    body: {
      leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
      isUnpaid: boolean;
      carryForward: boolean;
      applicableAfterDays: number;
      maxConsecutiveDays?: number;
      yearlyDays?: number | null;
      seniorityEveryYears?: number | null;
      seniorityExtraDays?: number | null;
      seniorityCapDays?: number | null;
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.leave.setTypeSettings(workspace, body.leaveType, {
      isUnpaid: body.isUnpaid,
      carryForward: body.carryForward,
      applicableAfterDays: body.applicableAfterDays,
      maxConsecutiveDays: body.maxConsecutiveDays,
      yearlyDays: body.yearlyDays,
      seniorityEveryYears: body.seniorityEveryYears,
      seniorityExtraDays: body.seniorityExtraDays,
      seniorityCapDays: body.seniorityCapDays,
    });
  }
}
