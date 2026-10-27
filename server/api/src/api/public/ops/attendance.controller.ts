import {
  ClockInRequest,
  ClockOutRequest,
  CorrectAttendanceRequest,
  DecideOvertimeRequest,
  type AttendancePage,
  type ListQuery,
  type AttendanceRecord,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { TimeService } from '../../../modules/hr/application/time.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Attendance -> /api/v1/ops/attendance (ADR-058, AC-T4 to AC-T6).
 *
 * `attendance.record` is the front desk's: it clocks people in and out and
 * reads the day's sheet as roster cards. Correcting a record and validating a
 * self clock in are `attendance.approve`, a supervisor's.
 */
@Controller({ path: 'ops/attendance', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsAttendanceController {
  constructor(private readonly time: TimeService) {}

  @Get()
  @RequireAnyPermission('attendance.record', 'attendance.approve')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<AttendancePage> {
    return this.time.listAttendance(workspace, query);
  }

  @Post('clock-in')
  @RequirePermission('attendance.record')
  clockIn(
    @Body(new ZodValidationPipe(ClockInRequest)) body: ClockInRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRecord> {
    return this.time.clockIn(workspace, user.id, body);
  }

  @Post(':id/clock-out')
  @HttpCode(200)
  @RequirePermission('attendance.record')
  clockOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ClockOutRequest)) body: ClockOutRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRecord> {
    return this.time.clockOut(workspace, user.id, id, body);
  }

  @Post(':id/correct')
  @RequirePermission('attendance.approve')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CorrectAttendanceRequest)) body: CorrectAttendanceRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRecord> {
    return this.time.correct(workspace, user.id, id, body);
  }

  @Post(':id/validate')
  @HttpCode(200)
  @RequirePermission('attendance.approve')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRecord> {
    return this.time.validate(workspace, user.id, id);
  }

  /** Approve all of the overtime, or less (058-time AC-TM8). Only approved overtime reaches pay. */
  @Post(':id/overtime')
  @HttpCode(200)
  @RequirePermission('attendance.approve')
  overtime(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideOvertimeRequest)) body: DecideOvertimeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRecord> {
    return this.time.decideOvertime(workspace, user.id, id, body);
  }
}
