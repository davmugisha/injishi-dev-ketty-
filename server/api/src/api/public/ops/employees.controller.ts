import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { EmployeeService } from '../../../modules/hr/application/employee.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';

import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';

/**
 * The employee roster -> `GET /api/v1/ops/employees` (HR module, Phase 1,
 * first pass — no ADR yet).
 *
 * Gated on `employee.manage`, provisionally owner and manager — see the
 * permission's own comment in `authz.ts` for why this is marked draft
 * rather than settled.
 */
@Controller({ path: 'ops/employees', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsEmployeesController {
  constructor(private readonly employeeService: EmployeeService) {}

   @Get()
  @RequirePermission('employee.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace) {
    return this.employeeService.list(workspace);
  }

  @Post(':id/events')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async recordEvent(
    @Param('id', ParseUUIDPipe) departmentMemberId: string,
    @Body()
    body: {
      eventType: 'hired' | 'title_change' | 'department_change' | 'employment_type_change' | 'terminated';
      jobTitle?: string;
      employmentType?: 'full_time' | 'part_time' | 'contract' | 'casual';
      note?: string;
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.employeeService.recordEvent(
      workspace,
      departmentMemberId,
      body.eventType,
      { jobTitle: body.jobTitle, employmentType: body.employmentType, note: body.note },
      user.id,
    );
  }
}