import {
  CreateAttendanceRequestRequest,
  CreateKioskRequest,
  CreateOrgHolidayRequest,
  CreateRotationAssignmentRequest,
  CreateRotationPatternRequest,
  CreateShiftRequestRequest,
  CreateWeeklyOffRequest,
  DecideRequestBody,
  EndRotationAssignmentRequest,
  InsightsQuery,
  MonthlyQuery,
  PutAttendancePolicyRequest,
  PutBranchClockSettingsRequest,
  RotationAssignmentQuery,
  RotationPatternQuery,
  SetKioskPinRequest,
  TimeRequestBulkRequest,
  UnlockKioskPinRequest,
  UpdateOrgHolidayRequest,
  UpdateRotationPatternRequest,
  UpdateWeeklyOffRequest,
  type AttendanceRequest,
  type AttendanceRequestPage,
  type AttendanceSettings,
  type BulkResponse,
  type Kiosk,
  type KioskList,
  type KioskPairingCode,
  type KioskPinState,
  type LateEarlyReport,
  type ListIds,
  type ListQuery,
  type MonthlySummary,
  type OrgHoliday,
  type OrgHolidayList,
  type RotationAssignment,
  type RotationAssignmentList,
  type RotationPattern,
  type RotationPatternList,
  type ShiftRequest,
  type ShiftRequestPage,
  type WeeklyOff,
  type WeeklyOffList,
} from '@injishi/contracts';
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

import { AttendanceInsightsService } from '../../../modules/hr/application/attendance-insights.service';
import { KioskService } from '../../../modules/hr/application/kiosk.service';
import { RotationService } from '../../../modules/hr/application/rotation.service';
import { TimeRequestsService } from '../../../modules/hr/application/time-requests.service';
import { TimeSettingsService } from '../../../modules/hr/application/time-settings.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
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
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Time (ADR-058, 058-time): rotations, shift and attendance requests, the
 * attendance settings and kiosks, the insights, a person's kiosk PIN, and a
 * business's own holidays and weekly days off. Several controllers in one file,
 * as `service-catalog.controller.ts` does, because they share one service
 * layer; the routes are 058-time's API surface table.
 */

function noteOf(body: DecideRequestBody): string | null {
  return body.note?.trim() || null;
}

/** Rotations -> /api/v1/ops/rotation-patterns (058-time AC-TM3). */
@Controller({ path: 'ops/rotation-patterns', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRotationPatternsController {
  constructor(private readonly rotations: RotationService) {}

  @Get()
  @RequireAnyPermission('roster.manage', 'attendance.record')
  list(
    @Query(new ZodValidationPipe(RotationPatternQuery)) query: RotationPatternQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<RotationPatternList> {
    return this.rotations.patterns(workspace, query.propertyId);
  }

  @Post()
  @RequirePermission('roster.manage')
  create(
    @Body(new ZodValidationPipe(CreateRotationPatternRequest)) body: CreateRotationPatternRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RotationPattern> {
    return this.rotations.createPattern(workspace, user.id, body);
  }

  /** A name or an archive only: the steps of a pattern somebody is on never change. */
  @Patch(':id')
  @RequirePermission('roster.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRotationPatternRequest)) body: UpdateRotationPatternRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RotationPattern> {
    return this.rotations.updatePattern(workspace, user.id, id, body);
  }
}

/** People on a rotation -> /api/v1/ops/rotation-assignments (058-time AC-TM3). */
@Controller({ path: 'ops/rotation-assignments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRotationAssignmentsController {
  constructor(private readonly rotations: RotationService) {}

  @Get()
  @RequirePermission('roster.manage')
  list(
    @Query(new ZodValidationPipe(RotationAssignmentQuery)) query: RotationAssignmentQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<RotationAssignmentList> {
    return this.rotations.assignments(workspace, { patternId: query.patternId, includeEnded: query.includeEnded === 'true' });
  }

  /** Assigning writes the next 28 days of drafts at once; the daily job keeps the horizon. */
  @Post()
  @RequirePermission('roster.manage')
  create(
    @Body(new ZodValidationPipe(CreateRotationAssignmentRequest)) body: CreateRotationAssignmentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RotationAssignment> {
    return this.rotations.assign(workspace, user.id, body);
  }

  /** Ending cancels the drafts it generated after its last day. */
  @Post(':id/end')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EndRotationAssignmentRequest)) body: EndRotationAssignmentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RotationAssignment> {
    return this.rotations.end(workspace, user.id, id, body);
  }
}

/**
 * Shift and swap requests -> /api/v1/ops/shift-requests (058-time AC-TM5).
 * Decided by `roster.manage` for the person's branch, never by somebody a
 * request is about; routed to the reporting manager as it was asked.
 */
@Controller({ path: 'ops/shift-requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsShiftRequestsController {
  constructor(private readonly requests: TimeRequestsService) {}

  @Get()
  @RequirePermission('roster.manage')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequestPage> {
    return this.requests.shiftPage(workspace, user.id, query);
  }

  @Get('ids')
  @RequirePermission('roster.manage')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ListIds> {
    return this.requests.shiftIds(workspace, user.id, query);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  bulk(
    @Body(new ZodValidationPipe(TimeRequestBulkRequest)) body: TimeRequestBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.requests.shiftBulk(workspace, user.id, body);
  }

  /** On someone's behalf. A swap waits for the colleague before it can be decided. */
  @Post()
  @RequirePermission('roster.manage')
  create(
    @Body(new ZodValidationPipe(CreateShiftRequestRequest)) body: CreateShiftRequestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.requests.createShiftFor(workspace, user.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideRequestBody)) body: DecideRequestBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.requests.approveShift(workspace, user.id, id, noteOf(body));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideRequestBody)) body: DecideRequestBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.requests.rejectShift(workspace, user.id, id, noteOf(body));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.requests.cancelShiftOps(workspace, user.id, id);
  }

  /** For a colleague with no account, who cannot accept a swap themselves. */
  @Post(':id/accept-for-colleague')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  acceptForColleague(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.requests.acceptSwapForColleague(workspace, user.id, id);
  }
}

/**
 * Attendance requests -> /api/v1/ops/attendance-requests (058-time AC-TM6).
 * The desk files one (`attendance.record`); a supervisor decides
 * (`attendance.approve`), and approving writes the record in the same
 * transaction.
 */
@Controller({ path: 'ops/attendance-requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsAttendanceRequestsController {
  constructor(private readonly requests: TimeRequestsService) {}

  @Get()
  @RequirePermission('attendance.approve')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequestPage> {
    return this.requests.attendancePage(workspace, user.id, query);
  }

  @Get('ids')
  @RequirePermission('attendance.approve')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ListIds> {
    return this.requests.attendanceIds(workspace, user.id, query);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('attendance.approve')
  bulk(
    @Body(new ZodValidationPipe(TimeRequestBulkRequest)) body: TimeRequestBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.requests.attendanceBulk(workspace, user.id, body);
  }

  @Post()
  @RequirePermission('attendance.record')
  create(
    @Body(new ZodValidationPipe(CreateAttendanceRequestRequest)) body: CreateAttendanceRequestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.requests.createAttendanceFor(workspace, user.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('attendance.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideRequestBody)) body: DecideRequestBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.requests.approveAttendance(workspace, user.id, id, noteOf(body));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('attendance.approve')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideRequestBody)) body: DecideRequestBody,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.requests.rejectAttendance(workspace, user.id, id, noteOf(body));
  }
}

/**
 * The attendance settings, kiosks and insights -> /api/v1/ops/attendance/*
 * (058-time AC-TM4, AC-TM7 to AC-TM10, AC-TM13). Beside slice 1's
 * `OpsAttendanceController` on the same path; the records stay there.
 */
@Controller({ path: 'ops/attendance', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsAttendanceSettingsController {
  constructor(
    private readonly settings: TimeSettingsService,
    private readonly kiosks: KioskService,
    private readonly insights: AttendanceInsightsService,
  ) {}

  /** The default policy, each branch's own, and each branch's geofence. Read by anyone who works time. */
  @Get('policies')
  @RequireAnyPermission('roster.manage', 'attendance.record', 'attendance.approve', 'people.manage')
  policies(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<AttendanceSettings> {
    return this.settings.attendanceSettings(workspace);
  }

  @Put('policies')
  @RequirePermission('roster.manage')
  putPolicy(
    @Body(new ZodValidationPipe(PutAttendancePolicyRequest)) body: PutAttendancePolicyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceSettings> {
    return this.settings.putPolicy(workspace, user.id, body);
  }

  @Put('clock-settings/:propertyId')
  @RequirePermission('roster.manage')
  putClockSettings(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(PutBranchClockSettingsRequest)) body: PutBranchClockSettingsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceSettings> {
    return this.settings.putClockSettings(workspace, user.id, propertyId, body);
  }

  // --- Kiosks (AC-TM10) ------------------------------------------------------

  @Get('kiosks')
  @RequirePermission('attendance.record')
  kioskList(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<KioskList> {
    return this.kiosks.list(workspace);
  }

  /** Answers the pairing code once; it lives ten minutes. */
  @Post('kiosks')
  @RequirePermission('attendance.record')
  createKiosk(
    @Body(new ZodValidationPipe(CreateKioskRequest)) body: CreateKioskRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<KioskPairingCode> {
    return this.kiosks.create(workspace, user.id, body);
  }

  @Post('kiosks/:id/pairing-code')
  @RequirePermission('attendance.record')
  pairingCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<KioskPairingCode> {
    return this.kiosks.newPairingCode(workspace, user.id, id);
  }

  @Post('kiosks/:id/revoke')
  @HttpCode(200)
  @RequirePermission('attendance.record')
  revokeKiosk(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Kiosk> {
    return this.kiosks.revoke(workspace, user.id, id);
  }

  @Post('kiosks/:id/unlock-pin')
  @HttpCode(204)
  @RequirePermission('attendance.record')
  unlockPin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UnlockKioskPinRequest)) body: UnlockKioskPinRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.kiosks.unlockPin(workspace, user.id, id, body);
  }

  // --- Insights (AC-TM13): people.manage only on this side (index contract 7) ------------------

  @Get('insights/late-early')
  @RequirePermission('people.manage')
  lateEarly(
    @Query(new ZodValidationPipe(InsightsQuery)) query: InsightsQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LateEarlyReport> {
    return this.insights.lateEarly(workspace, query);
  }

  @Get('insights/monthly')
  @RequirePermission('people.manage')
  monthly(
    @Query(new ZodValidationPipe(MonthlyQuery)) query: MonthlyQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<MonthlySummary> {
    return this.insights.monthly(workspace, query);
  }
}

/** A person's kiosk PIN -> /api/v1/ops/employees/:id/kiosk-pin (058-time AC-TM11). Never shown again. */
@Controller({ path: 'ops/employees', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsEmployeeKioskPinController {
  constructor(private readonly kiosks: KioskService) {}

  @Get(':id/kiosk-pin')
  @RequireAnyPermission('people.manage', 'attendance.record')
  state(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<KioskPinState> {
    return this.kiosks.pinState(workspace, id);
  }

  @Put(':id/kiosk-pin')
  @RequireAnyPermission('people.manage', 'attendance.record')
  set(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetKioskPinRequest)) body: SetKioskPinRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<KioskPinState> {
    return this.kiosks.setPin(workspace, user.id, id, body);
  }
}

/**
 * A business's own holidays and weekly days off -> /api/v1/ops/hr/holidays and
 * /weekly-offs (058-time AC-TM12). Read by whoever plans time or decides leave,
 * because both count days by them; written by `people.manage` or
 * `roster.manage`. Settings, so a mistaken one may be removed.
 */
@Controller({ path: 'ops/hr', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHrTimeSettingsController {
  constructor(private readonly settings: TimeSettingsService) {}

  @Get('holidays')
  @RequireAnyPermission('people.view', 'people.manage', 'roster.manage', 'attendance.approve', 'leave.approve')
  holidays(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OrgHolidayList> {
    return this.settings.holidays(workspace);
  }

  @Post('holidays')
  @RequireAnyPermission('people.manage', 'roster.manage')
  createHoliday(
    @Body(new ZodValidationPipe(CreateOrgHolidayRequest)) body: CreateOrgHolidayRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OrgHoliday> {
    return this.settings.createHoliday(workspace, user.id, body);
  }

  @Patch('holidays/:id')
  @RequireAnyPermission('people.manage', 'roster.manage')
  updateHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOrgHolidayRequest)) body: UpdateOrgHolidayRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OrgHoliday> {
    return this.settings.updateHoliday(workspace, user.id, id, body);
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  @RequireAnyPermission('people.manage', 'roster.manage')
  deleteHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.settings.deleteHoliday(workspace, user.id, id);
  }

  @Get('weekly-offs')
  @RequireAnyPermission('people.view', 'people.manage', 'roster.manage', 'attendance.approve', 'leave.approve')
  weeklyOffs(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<WeeklyOffList> {
    return this.settings.weeklyOffs(workspace);
  }

  @Post('weekly-offs')
  @RequireAnyPermission('people.manage', 'roster.manage')
  createWeeklyOff(
    @Body(new ZodValidationPipe(CreateWeeklyOffRequest)) body: CreateWeeklyOffRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WeeklyOff> {
    return this.settings.createWeeklyOff(workspace, user.id, body);
  }

  @Patch('weekly-offs/:id')
  @RequireAnyPermission('people.manage', 'roster.manage')
  updateWeeklyOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateWeeklyOffRequest)) body: UpdateWeeklyOffRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WeeklyOff> {
    return this.settings.updateWeeklyOff(workspace, user.id, id, body);
  }

  @Delete('weekly-offs/:id')
  @HttpCode(204)
  @RequireAnyPermission('people.manage', 'roster.manage')
  deleteWeeklyOff(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.settings.deleteWeeklyOff(workspace, user.id, id);
  }
}
