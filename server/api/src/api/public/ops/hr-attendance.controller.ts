import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AttendanceService } from '../../../modules/hr/application/attendance.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';

/**
 * Attendance, as HR sees it -> `/api/v1/ops/hr/attendance` (HR module, Phase 5
 * — first pass, no ADR yet). Gated on `employee.manage`.
 *
 * The employee's own clock is not here. Clocking in and out, and reading your
 * own days, are on `ops/my-hr/time`, which gates no permission because it
 * takes no employee id. This controller is the other half: everybody's days,
 * and the right to write or correct one.
 *
 * Under `ops/hr/`, not `ops/attendance`, which main's Staff module (ADR-058)
 * already answers at.
 */
@Controller({ path: 'ops/hr/attendance', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHrAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** Everybody on one day. No `date` is today. */
  @Get()
  @RequirePermission('employee.manage')
  board(
    @Query('date') date: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<AttendanceService['board']> {
    return this.attendance.board(workspace, date || undefined);
  }

  /** The timesheet: a stretch of days added up per person. */
  @Get('summary')
  @RequirePermission('employee.manage')
  summary(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): ReturnType<AttendanceService['summary']> {
    return this.attendance.summary(workspace, from || undefined, to || undefined);
  }

  /** Write a day for somebody, or correct the one that is there. */
  @Post('entries')
  @RequirePermission('employee.manage')
  record(
    @Body()
    body: { departmentMemberId: string; workDate: string; clockIn: string; clockOut?: string | null; note?: string },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<AttendanceService['record']> {
    return this.attendance.record(workspace, user.id, body);
  }

  @Delete('entries/:entryId')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.attendance.remove(workspace, entryId);
  }
}
