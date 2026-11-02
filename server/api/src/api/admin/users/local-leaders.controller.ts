import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  AppointOfficerRequest,
  EndAppointmentQuery,
  type LeaderCoverage,
  type OversightAppointment,
  type OversightAppointmentList,
  OversightAppointmentQuery,
} from '@injishi/contracts';

import { RequireFreshStepUp } from '../../../shared/auth/require-fresh-step-up.decorator';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../../public/ops/pay-runs.controller';
import { LocalLeadersService } from './local-leaders.service';

/**
 * Local leaders and officers → /api/v1/admin/local-leaders (P5, blueprint 2.5).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order: platform staff, the
 * emailed step-up on this session, then the route's permission. Reading the
 * list and the coverage report is `admin.user.view`; appointing and ending is
 * `admin.user.role.grant`, which only `super_admin` holds.
 *
 * The fixed paths are declared before `:assignmentId`.
 */
@Controller({ path: 'admin/local-leaders', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminLocalLeadersController {
  constructor(private readonly leaders: LocalLeadersService) {}

  @Get()
  @RequireStaffPermission('admin.user.view')
  list(@Query(new ZodValidationPipe(OversightAppointmentQuery)) query: OversightAppointmentQuery): Promise<OversightAppointmentList> {
    return this.leaders.list(query);
  }

  @Get('coverage')
  @RequireStaffPermission('admin.user.view')
  coverage(): Promise<LeaderCoverage> {
    return this.leaders.coverage();
  }

  @Get('coverage.csv')
  @RequireStaffPermission('admin.user.view')
  async coverageCsv(@Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const body = await this.leaders.coverageCsv();
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="local-leader-coverage.csv"')
      .header('cache-control', 'no-store')
      .send(body);
  }

  /** Appoint by email. The reason is the audit row's. */
  @Post()
  @HttpCode(201)
  @RequireStaffPermission('admin.user.role.grant')
  // Appointing hands out authority: the step-up must be recent (2026-11-02).
  @RequireFreshStepUp()
  appoint(
    @Body(new ZodValidationPipe(AppointOfficerRequest)) body: AppointOfficerRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<OversightAppointment> {
    return this.leaders.appoint(user.id, body);
  }

  /** End an appointment. The reason rides on the query, as `DELETE /admin/users/:id/oversight/:id` does. */
  @Delete(':assignmentId')
  @HttpCode(204)
  @RequireStaffPermission('admin.user.role.grant')
  async end(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query(new ZodValidationPipe(EndAppointmentQuery)) query: EndAppointmentQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.leaders.end(user.id, assignmentId, query.reason);
  }
}
