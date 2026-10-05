import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { LeaveService } from '../../../modules/hr/application/leave.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';

/**
 * Leave requests, balances, and per-type settings (HR module, Phase 4).
 * Gated on employee.manage.
 */
@Controller({ path: 'ops/leave', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('requests')
  @RequirePermission('employee.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace) {
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
  ) {
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
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.leave.decide(id, body.status, user.id);
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

  @Get('balances/:departmentMemberId')
  @RequirePermission('employee.manage')
  getBalance(
    @Param('departmentMemberId', ParseUUIDPipe) departmentMemberId: string,
    @Query('leaveType') leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    @Query('year') year: string,
  ) {
    return this.leave.getBalanceSummary(departmentMemberId, leaveType, Number(year));
  }

  @Get('type-settings')
  @RequirePermission('employee.manage')
  listTypeSettings(@CurrentWorkspace() workspace: ScopedWorkspace) {
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
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.leave.setTypeSettings(workspace, body.leaveType, {
      isUnpaid: body.isUnpaid,
      carryForward: body.carryForward,
      applicableAfterDays: body.applicableAfterDays,
      maxConsecutiveDays: body.maxConsecutiveDays,
    });
  }
}
