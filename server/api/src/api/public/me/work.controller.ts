import {
  ChangeMyKioskPinRequest,
  CreateMyAttendanceRequestRequest,
  CreateMyShiftRequestRequest,
  MonthQuery,
  PhoneClockRequest,
  RangeQuery,
  TeamRequestsQuery,
  type AttendanceRequest,
  type KioskPinState,
  type MyAttendance,
  type MyAttendanceRequestList,
  type MyMonthlySummary,
  type MyRoster,
  type MyShiftRequestList,
  type MyTeam,
  type MyTeamAttendance,
  type MyTeamRequests,
  type MyTeamRoster,
  type MyWorkFileList,
  type PhoneClockResult,
  type ShiftRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { MyWorkService } from '../../../modules/hr/application/my-work.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * A person's own work -> /api/v1/me/work (ADR-058, 058-self-service, the
 * routes marked 4; 058-time AC-TM2, AC-TM5, AC-TM6, AC-TM9, AC-TM11, AC-TM13).
 *
 * `SessionGuard` only, never a workspace: ownership is the guard (index
 * contract 10). Every route names one of the caller's files, and any other id
 * answers 404. A file the person has left is read only (409 on a write).
 * `team/*` answers for a reporting manager about their direct reports, reads
 * only: nothing under `me/work` decides anything.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkController {
  constructor(private readonly work: MyWorkService) {}

  @Get()
  files(@CurrentUser() user: SessionUser): Promise<MyWorkFileList> {
    return this.work.files(user.id);
  }

  // --- Clock in and out from the phone ------------------------------------------------

  @Post(':employeeId/clock-in')
  clockIn(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(PhoneClockRequest)) body: PhoneClockRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PhoneClockResult> {
    return this.work.clockIn(user.id, employeeId, body);
  }

  @Post(':employeeId/clock-out')
  @HttpCode(200)
  clockOut(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(PhoneClockRequest)) body: PhoneClockRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PhoneClockResult> {
    return this.work.clockOut(user.id, employeeId, body);
  }

  // --- Roster and shift requests ------------------------------------------------------

  @Get(':employeeId/roster')
  roster(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(RangeQuery)) query: RangeQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyRoster> {
    return this.work.roster(user.id, employeeId, query);
  }

  @Get(':employeeId/shift-requests')
  shiftRequests(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyShiftRequestList> {
    return this.work.shiftRequests(user.id, employeeId);
  }

  @Post(':employeeId/shift-requests')
  createShiftRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateMyShiftRequestRequest)) body: CreateMyShiftRequestRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.work.createShiftRequest(user.id, employeeId, body);
  }

  @Post(':employeeId/shift-requests/:id/cancel')
  @HttpCode(200)
  cancelShiftRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.work.cancelShiftRequest(user.id, employeeId, id);
  }

  /** The colleague named in a swap says yes; only then can a manager decide it. */
  @Post(':employeeId/shift-requests/:id/accept')
  @HttpCode(200)
  acceptSwap(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.work.acceptSwap(user.id, employeeId, id);
  }

  @Post(':employeeId/shift-requests/:id/decline')
  @HttpCode(200)
  declineSwap(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.work.declineSwap(user.id, employeeId, id);
  }

  // --- Attendance ----------------------------------------------------------------

  @Get(':employeeId/attendance')
  attendance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(RangeQuery)) query: RangeQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyAttendance> {
    return this.work.attendance(user.id, employeeId, query);
  }

  @Get(':employeeId/attendance/requests')
  attendanceRequests(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(RangeQuery)) query: RangeQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyAttendanceRequestList> {
    return this.work.attendanceRequests(user.id, employeeId, query);
  }

  @Post(':employeeId/attendance/requests')
  createAttendanceRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateMyAttendanceRequestRequest)) body: CreateMyAttendanceRequestRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.work.createAttendanceRequest(user.id, employeeId, body);
  }

  @Post(':employeeId/attendance/requests/:id/cancel')
  @HttpCode(200)
  cancelAttendanceRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.work.cancelAttendanceRequest(user.id, employeeId, id);
  }

  /** The person's own month: their figures, never a colleague's. */
  @Get(':employeeId/attendance/summary')
  summary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(MonthQuery)) query: MonthQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyMonthlySummary> {
    return this.work.summary(user.id, employeeId, query.month);
  }

  // --- Kiosk PIN -------------------------------------------------------------

  @Get(':employeeId/kiosk-pin')
  pinState(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<KioskPinState> {
    return this.work.pinState(user.id, employeeId);
  }

  @Put(':employeeId/kiosk-pin')
  changePin(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(ChangeMyKioskPinRequest)) body: ChangeMyKioskPinRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<KioskPinState> {
    return this.work.changePin(user.id, employeeId, body);
  }

  // --- A reporting manager's team: reads only ------------------------------------------------

  @Get(':employeeId/team')
  team(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyTeam> {
    return this.work.team(user.id, employeeId);
  }

  @Get(':employeeId/team/roster')
  teamRoster(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(RangeQuery)) query: RangeQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyTeamRoster> {
    return this.work.teamRoster(user.id, employeeId, query);
  }

  @Get(':employeeId/team/attendance')
  teamAttendance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(RangeQuery)) query: RangeQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyTeamAttendance> {
    return this.work.teamAttendance(user.id, employeeId, query);
  }

  @Get(':employeeId/team/requests')
  teamRequests(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(TeamRequestsQuery)) query: TeamRequestsQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<MyTeamRequests> {
    return this.work.teamRequests(user.id, employeeId, query);
  }

  @Get(':employeeId/team/requests/shift/:id')
  teamShiftRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ShiftRequest> {
    return this.work.teamShiftRequest(user.id, employeeId, id);
  }

  @Get(':employeeId/team/requests/attendance/:id')
  teamAttendanceRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AttendanceRequest> {
    return this.work.teamAttendanceRequest(user.id, employeeId, id);
  }
}
