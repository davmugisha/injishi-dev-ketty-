import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RosterService, type ShiftBody } from '../../../modules/hr/application/roster.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';

/**
 * The shift roster -> `/api/v1/ops/hr/roster` (HR module, Phase 5 — first
 * pass, no ADR yet). Gated on `employee.manage`, like the rest of HR's side:
 * deciding who works when is managing the roster of employees.
 *
 * Under `ops/hr/`, not `ops/roster`: main's Staff module (ADR-058) answers at
 * that path, and two controllers on one path would be a boot failure the day
 * the branches meet.
 */
@Controller({ path: 'ops/hr/roster', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHrRosterController {
  constructor(private readonly roster: RosterService) {}

  /** The week a day sits in. No `from` is this week. */
  @Get()
  @RequirePermission('employee.manage')
  week(
    @Query('from') from: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<RosterService['week']> {
    return this.roster.week(workspace, from || undefined);
  }

  @Get('shifts')
  @RequirePermission('employee.manage')
  shifts(@CurrentWorkspace() workspace: ScopedWorkspace): ReturnType<RosterService['shifts']> {
    return this.roster.shifts(workspace);
  }

  @Post('shifts')
  @RequirePermission('employee.manage')
  createShift(
    @Body() body: ShiftBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<RosterService['createShift']> {
    return this.roster.createShift(workspace, body);
  }

  @Patch('shifts/:shiftId')
  @RequirePermission('employee.manage')
  updateShift(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() body: ShiftBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<RosterService['updateShift']> {
    return this.roster.updateShift(workspace, shiftId, body);
  }

  /** Retires the shift. Past weeks keep it; it is no longer offered. */
  @Delete('shifts/:shiftId')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async retireShift(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.roster.retireShift(workspace, shiftId);
  }

  /** One person, one day, one shift. A null shift clears the day. */
  @Put('assignments')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async assign(
    @Body() body: { departmentMemberId: string; workDate: string; shiftId: string | null },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.roster.assign(workspace, user.id, body);
  }

  @Post('copy-week')
  @RequirePermission('employee.manage')
  copyWeek(
    @Body() body: { from: string; to: string },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<RosterService['copyWeek']> {
    return this.roster.copyWeek(workspace, user.id, body);
  }
}
